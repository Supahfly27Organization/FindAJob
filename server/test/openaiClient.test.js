import { describe, it, expect, vi } from 'vitest';
import {
  buildSearchPrompt,
  buildSearchTool,
  buildSearchRequest,
  searchJobPostings,
  parseSearchResponse,
  buildAdaptationPrompt,
  parseAdaptationResponse,
  MAX_RESULTS,
  MAX_RESULTS_PER_SOURCE
} from '../src/services/openaiClient.js';
import { JOB_SEARCH_LOCATION } from '../src/config.js';

// A stand-in for the OpenAI client: `searchJobPostings` takes one via its options bag purely
// so these tests never touch the network.
function stubClient(responder) {
  return { responses: { create: vi.fn(responder) } };
}

function respondWith(postings) {
  return { output_text: JSON.stringify({ postings }) };
}

describe('buildSearchPrompt', () => {
  it('includes the title, Israel, both result caps, and the freshness window', () => {
    const prompt = buildSearchPrompt('Product Manager');
    expect(prompt).toContain('Product Manager');
    expect(prompt).toContain('Israel');
    expect(prompt).toContain(`at most ${MAX_RESULTS_PER_SOURCE} postings`);
    expect(prompt).toContain(`At most ${MAX_RESULTS} will be kept`);
    expect(prompt).toContain('45');
  });

  it('scopes the search to the source when the source has domain filters', () => {
    const prompt = buildSearchPrompt('Product Manager', {
      name: 'AllJobs',
      allowedDomains: ['alljobs.co.il']
    });
    expect(prompt).toContain('AllJobs');
    expect(prompt).toContain('alljobs.co.il');
    expect(prompt).toContain('do not look elsewhere');
  });

  it('points an unfiltered source at employers\' own career pages', () => {
    const prompt = buildSearchPrompt('Product Manager', { name: 'Company career pages', allowedDomains: null });
    expect(prompt).toContain('career pages');
    expect(prompt).not.toContain('do not look elsewhere');
  });

  it('requires the direct application URL and requests aggregator fields', () => {
    const prompt = buildSearchPrompt('Product Manager');
    expect(prompt).toContain('direct application URL');
    expect(prompt).toContain('never a search-results page');
    expect(prompt).toContain('"aggregatorName"');
    expect(prompt).toContain('"aggregatorUrl"');
  });

  it('forbids fabricating a URL', () => {
    const prompt = buildSearchPrompt('Product Manager');
    expect(prompt).toContain('never guess, construct, or approximate');
    expect(prompt).toContain('omit that result entirely rather than inventing one');
  });
});

describe('parseSearchResponse', () => {
  it('parses a plain JSON array', () => {
    const result = parseSearchResponse('[{"postingTitle":"PM","url":"https://example.com/1"}]');
    expect(result).toEqual([{ postingTitle: 'PM', url: 'https://example.com/1' }]);
  });

  it('parses a JSON array wrapped in a markdown code fence', () => {
    const result = parseSearchResponse('```json\n[{"postingTitle":"PM","url":"https://example.com/1"}]\n```');
    expect(result).toEqual([{ postingTitle: 'PM', url: 'https://example.com/1' }]);
  });

  it('parses an explicit empty array', () => {
    expect(parseSearchResponse('[]')).toEqual([]);
  });

  it('unwraps the { postings: [...] } object the json_schema format produces', () => {
    const result = parseSearchResponse('{"postings":[{"postingTitle":"PM","url":"https://example.com/1"}]}');
    expect(result).toEqual([{ postingTitle: 'PM', url: 'https://example.com/1' }]);
  });

  it('throws on invalid JSON', () => {
    expect(() => parseSearchResponse('not json')).toThrow('not valid JSON');
  });

  it('throws when the JSON is valid but is neither an array nor a postings object', () => {
    expect(() => parseSearchResponse('{"postingTitle":"PM"}')).toThrow('not a JSON array');
  });
});

describe('buildSearchTool', () => {
  it('always sends the user location and a high search context size', () => {
    const tool = buildSearchTool({ name: 'Company career pages', allowedDomains: null });
    expect(tool.type).toBe('web_search');
    expect(tool.search_context_size).toBe('high');
    expect(tool.user_location).toEqual(JOB_SEARCH_LOCATION);
    expect(tool.user_location.country).toBe('IL');
  });

  it('restricts the search to the source domains when the source has them', () => {
    const tool = buildSearchTool({ name: 'AllJobs', allowedDomains: ['alljobs.co.il'] });
    expect(tool.filters).toEqual({ allowed_domains: ['alljobs.co.il'] });
  });

  it('omits the filters key entirely for an unfiltered source', () => {
    expect(buildSearchTool({ name: 'Company career pages', allowedDomains: null })).not.toHaveProperty(
      'filters'
    );
  });
});

describe('buildSearchRequest', () => {
  it('forces the web_search tool so the model cannot answer from memory', () => {
    expect(buildSearchRequest('Product Manager').tool_choice).toBe('required');
  });

  it('requests the structured job_postings schema', () => {
    const request = buildSearchRequest('Product Manager');
    expect(request.text.format.type).toBe('json_schema');
    expect(request.text.format.name).toBe('job_postings');
    expect(request.text.format.strict).toBe(true);
  });

  it('asks for reasoning effort', () => {
    expect(buildSearchRequest('Product Manager').reasoning).toEqual({ effort: 'high' });
  });
});

describe('searchJobPostings', () => {
  const sources = [
    { name: 'AllJobs', allowedDomains: ['alljobs.co.il'] },
    { name: 'LinkedIn', allowedDomains: ['linkedin.com'] }
  ];

  it('issues one call per source and unions the results', async () => {
    const client = stubClient(({ tools }) =>
      tools[0].filters.allowed_domains[0] === 'alljobs.co.il'
        ? respondWith([{ postingTitle: 'PM', url: 'https://alljobs.co.il/1' }])
        : respondWith([{ postingTitle: 'PM', url: 'https://linkedin.com/jobs/view/2' }])
    );

    const result = await searchJobPostings('sk-test', 'Product Manager', { client, sources });

    expect(client.responses.create).toHaveBeenCalledTimes(2);
    expect(result.map((p) => p.url)).toEqual([
      'https://alljobs.co.il/1',
      'https://linkedin.com/jobs/view/2'
    ]);
  });

  it('drops a posting returned by two different sources under the same URL', async () => {
    const client = stubClient(() => respondWith([{ postingTitle: 'PM', url: 'https://example.com/1' }]));

    const result = await searchJobPostings('sk-test', 'Product Manager', { client, sources });

    expect(result).toHaveLength(1);
  });

  it('interleaves sources so the first one cannot fill the whole result cap', async () => {
    const client = stubClient(({ tools }) =>
      tools[0].filters.allowed_domains[0] === 'alljobs.co.il'
        ? respondWith([
            { postingTitle: 'A1', url: 'https://alljobs.co.il/1' },
            { postingTitle: 'A2', url: 'https://alljobs.co.il/2' }
          ])
        : respondWith([{ postingTitle: 'L1', url: 'https://linkedin.com/jobs/view/1' }])
    );

    const result = await searchJobPostings('sk-test', 'Product Manager', { client, sources });

    expect(result.map((p) => p.postingTitle)).toEqual(['A1', 'L1', 'A2']);
  });

  it('keeps the results from the sources that worked when one source fails', async () => {
    const client = stubClient(({ tools }) => {
      if (tools[0].filters.allowed_domains[0] === 'alljobs.co.il') {
        return Promise.reject(new Error('alljobs timed out'));
      }
      return respondWith([{ postingTitle: 'PM', url: 'https://linkedin.com/jobs/view/2' }]);
    });

    const result = await searchJobPostings('sk-test', 'Product Manager', { client, sources });

    expect(result).toHaveLength(1);
  });

  it('rethrows the original error, status intact, when every source fails', async () => {
    const authError = new Error('Incorrect API key provided');
    authError.status = 401;
    const client = stubClient(() => Promise.reject(authError));

    // searchService maps status 401 to "your key was rejected", so the status has to survive
    // the fan-out rather than being flattened into a generic "no results".
    await expect(searchJobPostings('sk-bad', 'Product Manager', { client, sources })).rejects.toMatchObject({
      status: 401
    });
  });
});

describe('buildAdaptationPrompt', () => {
  it('includes the template text and the posting details', () => {
    const prompt = buildAdaptationPrompt('Jane Doe\nPM at Acme', {
      postingTitle: 'Senior PM',
      company: 'Beta',
      description: 'Lead the product'
    });
    expect(prompt).toContain('Jane Doe');
    expect(prompt).toContain('PM at Acme');
    expect(prompt).toContain('Senior PM');
    expect(prompt).toContain('Beta');
    expect(prompt).toContain('Lead the product');
  });
});

describe('parseAdaptationResponse', () => {
  it('parses a valid adaptation response', () => {
    const result = parseAdaptationResponse(
      '{"adaptedResumeText":"Jane Doe","originalPositionCount":1,"retainedPositionCount":1}'
    );
    expect(result).toEqual({ adaptedResumeText: 'Jane Doe', originalPositionCount: 1, retainedPositionCount: 1 });
  });

  it('parses a response wrapped in a markdown code fence', () => {
    const result = parseAdaptationResponse(
      '```json\n{"adaptedResumeText":"Jane Doe","originalPositionCount":1,"retainedPositionCount":1}\n```'
    );
    expect(result.adaptedResumeText).toBe('Jane Doe');
  });

  it('throws on invalid JSON', () => {
    expect(() => parseAdaptationResponse('not json')).toThrow('not valid JSON');
  });

  it('throws when a required field is missing', () => {
    expect(() => parseAdaptationResponse('{"adaptedResumeText":"Jane Doe"}')).toThrow('missing required fields');
  });

  it('rejects a non-finite originalPositionCount smuggled through as a numeric overflow', () => {
    // JSON.parse cannot produce a literal NaN (bare "NaN" is invalid JSON syntax), but a huge
    // exponent like 1e400 IS valid JSON and parses to Infinity — `typeof Infinity === 'number'`
    // just like `typeof NaN === 'number'`, so the old `typeof x !== 'number'` guard would have
    // let this through a real JSON round trip. Number.isFinite correctly rejects it.
    expect(() =>
      parseAdaptationResponse('{"adaptedResumeText":"x","originalPositionCount":1e400,"retainedPositionCount":1}')
    ).toThrow('missing required fields');
  });

  it('rejects a numeric-looking string for retainedPositionCount instead of coercing it', () => {
    expect(() =>
      parseAdaptationResponse('{"adaptedResumeText":"x","originalPositionCount":1,"retainedPositionCount":"1"}')
    ).toThrow('missing required fields');
  });
});
