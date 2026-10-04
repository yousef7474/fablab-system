// Shared Gemini call with model fallback (ID-card reading, institution
// summaries). Google retires and renames models often, and "thinking"
// options differ per generation, so a single call walks a list:
//
// - Missing / retired model (404) → next model. When the 404 names a
//   replacement ("use models/X"), X is tried too.
// - Model rejects the thinking option (400 invalid argument) → same
//   model again with thinkingLevel 'low', then with no thinking option.
// - Overloaded / rate-limited / timed out → one quick retry, then the
//   next model.
// - Anything else (bad key, permission) → thrown straight away.
//
// GEMINI_MODEL in server/.env pins a single model.
const MODEL_CANDIDATES = process.env.GEMINI_MODEL
  ? [process.env.GEMINI_MODEL]
  : [
      'gemini-flash-latest',
      'gemini-3.8-flash',
      'gemini-3.5-flash-lite',
      'gemini-flash-lite-latest',
      'gemini-pro-latest'
    ];

const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const _msg = (err) => String((err && err.message) || err || '');
const _isMissing = (m) => /\b404\b|not found|no longer available|is not supported|does not exist/i.test(m);
const _isBadArgument = (m) => /\b400\b|invalid argument|thinking/i.test(m) && !/api key/i.test(m);
const _isBusy = (m) => /\b(429|500|503|504)\b|quota|overloaded|high demand|unavailable|internal|timed? ?out|abort|deadline|fetch failed|ECONNRESET|ETIMEDOUT/i.test(m);

// The thinking-option variants tried on one model, in order.
const _thinkingVariants = (thinkingConfig) => (thinkingConfig
  ? [thinkingConfig, { thinkingLevel: 'low' }, null]
  : [null]);

/**
 * @param client            GoogleGenerativeAI instance
 * @param opts.parts        content parts for a single user turn
 * @param opts.generationConfig  config without thinkingConfig
 * @param opts.thinkingConfig    preferred thinking option (e.g. { thinkingBudget: 0 })
 * @param opts.deadlineMs   overall time budget (null = none)
 * @param opts.callTimeoutMs per-request timeout cap
 * @param opts.label        log prefix
 * @returns {{ result, model }}
 */
async function generateWithFallback(client, {
  parts, generationConfig = {}, thinkingConfig = null,
  deadlineMs = null, callTimeoutMs = 30000, label = 'gemini'
}) {
  const started = Date.now();
  const timeLeft = () => (deadlineMs == null ? Infinity : deadlineMs - (Date.now() - started));
  const queue = [...MODEL_CANDIDATES];
  const tried = new Set();
  let lastErr = null;

  while (queue.length) {
    const modelName = queue.shift();
    if (tried.has(modelName)) continue;
    tried.add(modelName);

    const variants = _thinkingVariants(thinkingConfig);
    let busyRetried = false;
    for (let v = 0; v < variants.length; v++) {
      const left = timeLeft();
      if (left < 4000) throw lastErr || new Error('Gemini deadline reached');
      const config = { ...generationConfig, ...(variants[v] ? { thinkingConfig: variants[v] } : {}) };
      try {
        const model = client.getGenerativeModel(
          { model: modelName, generationConfig: config },
          { timeout: Math.min(callTimeoutMs, left === Infinity ? callTimeoutMs : left) }
        );
        const result = await model.generateContent({ contents: [{ role: 'user', parts }] });
        return { result, model: modelName };
      } catch (err) {
        lastErr = err;
        const m = _msg(err);
        console.error(`${label}: ${modelName}${variants[v] ? ` ${JSON.stringify(variants[v])}` : ''} failed after ${Date.now() - started}ms: ${m.slice(0, 300)}`);
        if (_isMissing(m)) {
          // "Please update your code to use models/X" → try X next.
          const hint = /use\s+models\/([\w.-]+)/i.exec(m);
          if (hint && !tried.has(hint[1])) queue.unshift(hint[1]);
          break;
        }
        if (_isBusy(m)) {
          if (!busyRetried && timeLeft() > 8000) { busyRetried = true; await sleep(1500); v--; continue; }
          break;
        }
        if (_isBadArgument(m)) continue; // next thinking variant on the same model
        throw err;                        // key / permission problems
      }
    }
  }
  throw lastErr || new Error('No Gemini model available');
}

module.exports = { MODEL_CANDIDATES, generateWithFallback };
