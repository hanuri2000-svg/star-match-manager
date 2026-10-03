/* ELO 조회는 화면이 바뀌어도 한 요청으로 공유한다. */
(function (global) {
  'use strict';
  function createClient(options = {}) {
    const fetcher = options.fetch || ((...args) => global.fetch(...args));
    const storage = options.storage || global.localStorage;
    const now = options.now || Date.now;
    const isOnline = options.isOnline || (() => global.navigator?.onLine !== false);
    const timeoutMs = options.timeoutMs ?? 12000;
    const retryDelay = options.retryDelay ?? 600;
    const ttl = options.ttl ?? 5 * 60 * 1000;
    const cacheKey = 'spawnNote.eloDashboard.v1';
    const pending = new Map(), cache = new Map(), failures = new Map();
    const score = value => value !== '' && value != null && String(value).trim() !== '' && Number.isFinite(Number(String(value).replace(/,/g,'')));
    const valid = (data, player) => data?.player?.name === player && score(data.player.elo);
    const failure = (message, retryable = false) => Object.assign(new Error(message), {retryable});
    async function attempt(url, player) {
      const controller = new AbortController();
      let timer;
      const deadline = new Promise((_, reject) => {
        timer = setTimeout(() => {
          reject(failure('응답 시간 초과', true));
          controller.abort();
        }, timeoutMs);
      });
      try {
        return await Promise.race([deadline, (async () => {
          let response;
          try { response = await fetcher(url, {signal:controller.signal}); }
          catch (error) { throw failure(error?.message || 'ELO 서버 연결 실패', true); }
          if (!response.ok) {
            const data = await response.json().catch(() => ({}));
            throw failure(data.error || `ELO 조회 실패 (${response.status})`, [408,429,500,502,503,504].includes(response.status));
          }
          let data;
          try { data = await response.json(); }
          catch { throw failure('ELO 응답 형식 확인 실패', true); }
          if (!valid(data, player)) throw failure('ELO 선수·점수 확인 불가');
          return data;
        })()]);
      } finally { clearTimeout(timer); }
    }
    function get({player, today, base, force = false}) {
      player = String(player || '').trim();
      base = String(base || '').replace(/\/$/, '');
      if (!player || !today || !base) return Promise.reject(failure('ELO 조회 기준 확인 불가'));
      const key = JSON.stringify([base,player,today]);
      // 강제 새로고침도 이미 진행 중인 요청은 공유한다.
      if (pending.has(key)) return pending.get(key);
      if (!cache.has(key)) {
        try {
          const saved = JSON.parse(storage?.getItem(cacheKey) || 'null');
          if (saved?.player === player && saved.today === today && saved.base === base && valid(saved.data, player) && saved.checkedAt > 0) cache.set(key, saved);
        } catch {}
      }
      const failed = failures.get(key);
      if (!force && failed && now() - failed.at < 30000) return Promise.reject(failed.error);
      const previous = cache.get(key), age = previous ? now() - previous.checkedAt : Infinity;
      if (!force && age >= 0 && age < ttl) return Promise.resolve({...previous,cached:true});
      const request = Promise.resolve().then(async () => {
        try {
          if (!isOnline()) throw failure('인터넷 연결 없음');
          const query = new URLSearchParams({player,today});
          let data;
          for (let index = 0; index < 2; index++) {
            try { data = await attempt(`${base}/api/elo/dashboard?${query}`,player); break; }
            catch (error) {
              if (index === 1 || !error.retryable || !isOnline()) throw error;
              await new Promise(resolve => setTimeout(resolve,retryDelay));
            }
          }
          const result = {player,today,base,data,checkedAt:now(),cached:false};
          cache.set(key,result); failures.delete(key);
          try { storage?.setItem(cacheKey,JSON.stringify(result)); } catch {}
          return result;
        } catch (error) { failures.set(key,{at:now(),error}); throw error; }
        finally { pending.delete(key); }
      });
      pending.set(key,request);
      return request;
    }
    return {get};
  }
  if (typeof module === 'object' && module.exports) module.exports = {createClient};
  else global.EloDashboardClient = createClient();
})(typeof window === 'object' ? window : globalThis);
