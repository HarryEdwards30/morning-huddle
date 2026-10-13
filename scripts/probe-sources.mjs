// TEMPORARY: checks candidate news sources and ESPN endpoints from GitHub. Removed after use.
const UA = 'MorningHuddle/1.0 (personal news app)';
async function get(url) {
  const t = Date.now();
  try {
    const r = await fetch(url, { headers: { 'user-agent': UA }, redirect: 'follow', signal: AbortSignal.timeout(20000) });
    const text = await r.text();
    return { status: r.status, ms: Date.now() - t, text, type: r.headers.get('content-type') || '' };
  } catch (e) { return { status: 'ERR ' + e.message, ms: Date.now() - t, text: '' }; }
}
const feeds = {
  'nba general': [
    'https://hoopshype.com/feed/', 'https://basketball.realgm.com/rss/wiretap/0/0.xml', 'https://www.nba.com/news/rss.xml',
    'https://www.si.com/nba/rss', 'https://www.rotowire.com/rss/news.php?sport=NBA', 'https://www.nbcsports.com/nba/rss',
    'https://bleacherreport.com/articles/feed?tag_id=19', 'https://www.foxsports.com/nba/rss',
  ],
  'nfl general': [
    'https://profootballtalk.nbcsports.com/feed/', 'https://www.nbcsports.com/nfl/profootballtalk/rss', 'https://www.si.com/nfl/rss',
    'https://www.rotowire.com/rss/news.php?sport=NFL', 'https://www.nfl.com/rss/rsslanding?searchString=home', 'https://www.foxsports.com/nfl/rss',
    'https://bleacherreport.com/articles/feed?tag_id=16',
  ],
  'spurs': [
    'https://www.poundingtherock.com/rss/index.xml', 'https://www.poundingtherock.com/rss/current.xml',
    'https://www.nba.com/spurs/rss.xml', 'https://www.nba.com/spurs/news/rss', 'https://www.nba.com/spurs/feed',
    'https://sports.yahoo.com/nba/teams/san-antonio/rss/', 'https://sports.yahoo.com/nba/teams/san-antonio/rss.xml', 'https://sports.yahoo.com/nba/teams/sas/rss.xml',
    'https://www.cbssports.com/rss/headlines/nba/teams/sa/', 'https://www.cbssports.com/rss/headlines/nba/sa/',
    'https://www.expressnews.com/sports/spurs/feed/', 'https://www.kens5.com/feeds/syndication/rss/sports/spurs',
    'https://news.google.com/rss/search?q=%22San+Antonio+Spurs%22&hl=en-US&gl=US&ceid=US:en',
  ],
  'raiders': [
    'https://www.silverandblackpride.com/rss/index.xml', 'https://www.silverandblackpride.com/rss/current.xml',
    'https://www.raiders.com/rss/news', 'https://www.raiders.com/rss/feed', 'https://www.raiders.com/news/rss',
    'https://sports.yahoo.com/nfl/teams/las-vegas/rss/', 'https://sports.yahoo.com/nfl/teams/las-vegas/rss.xml', 'https://sports.yahoo.com/nfl/teams/lv/rss.xml',
    'https://www.cbssports.com/rss/headlines/nfl/teams/lv/', 'https://www.reviewjournal.com/sports/raiders/feed/',
    'https://news.google.com/rss/search?q=%22Las+Vegas+Raiders%22&hl=en-US&gl=US&ceid=US:en',
  ],
};
const decode = s => s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').replace(/<[^>]+>/g, ' ').replace(/&[a-z#0-9]+;/gi, ' ').replace(/\s+/g, ' ').trim();
for (const [group, urls] of Object.entries(feeds)) {
  console.log(`\n##### ${group}`);
  for (const url of urls) {
    const r = await get(url);
    const items = r.text.match(/<(item|entry)[\s>][\s\S]*?<\/(item|entry)>/g) || [];
    const first = items[0] || '';
    const title = decode((first.match(/<title[^>]*>([\s\S]*?)<\/title>/) || [])[1] || '');
    const date = decode((first.match(/<(pubDate|updated|published)[^>]*>([\s\S]*?)<\/(pubDate|updated|published)>/) || [])[2] || '');
    const desc = decode((first.match(/<description[^>]*>([\s\S]*?)<\/description>/) || [])[1] || '');
    const content = decode((first.match(/<(content:encoded|content)[^>]*>([\s\S]*?)<\/(content:encoded|content)>/) || [])[2] || '');
    console.log(`${r.status} ${r.ms}ms items=${items.length} desc=${desc.length} content=${content.length} | ${url}`);
    if (items.length) console.log(`     newest: ${date} | ${title.slice(0, 110)}`);
    else if (r.text) console.log(`     body: ${r.type} ${r.text.slice(0, 120).replace(/\s+/g, ' ')}`);
  }
}
// ESPN: game summaries (box score) and full story text.
const S = 'https://site.api.espn.com/apis/site/v2/sports';
async function json(url) { const r = await get(url); try { return JSON.parse(r.text); } catch { console.log('not json', r.status, url); return null; } }
for (const [sport, date] of [['football/nfl', '20261011'], ['basketball/nba', '20261011']]) {
  const board = await json(`${S}/${sport}/scoreboard?dates=${date}`);
  const ev = board?.events?.find(e => e.competitions?.[0]?.status?.type?.completed);
  console.log(`\n##### ${sport} summary for ${ev?.id} ${ev?.name}`);
  console.log('season type on scoreboard:', JSON.stringify(board?.leagues?.[0]?.season?.type));
  const comp = ev?.competitions?.[0];
  console.log('status:', JSON.stringify(comp?.status?.type), 'period', comp?.status?.period, 'records', JSON.stringify(comp?.competitors?.map(c => c.records?.[0]?.summary)));
  if (!ev) continue;
  const s = await json(`${S}/${sport}/summary?event=${ev.id}`);
  console.log('summary keys:', Object.keys(s || {}).join(','));
  for (const team of s?.boxscore?.players || []) {
    console.log(`team ${team.team?.abbreviation}: categories ${team.statistics?.map(c => `${c.name}[${(c.labels || []).join('/')}]`).join(' ; ')}`);
    const c0 = team.statistics?.[0];
    const a0 = c0?.athletes?.[0];
    console.log('   first athlete:', a0?.athlete?.displayName, JSON.stringify(a0?.stats), 'keys', Object.keys(a0 || {}).join(','));
  }
  console.log('header competitors:', JSON.stringify(s?.header?.competitions?.[0]?.competitors?.map(c => ({ abbr: c.team?.abbreviation, score: c.score, record: c.record?.[0]?.summary, linescores: c.linescores?.length }))));
  console.log('leaders:', JSON.stringify(s?.leaders?.[0]?.leaders?.map(l => l.name + ':' + l.leaders?.[0]?.displayValue)));
  console.log('summary size (chars):', JSON.stringify(s || {}).length);
}
for (const sport of ['football/nfl', 'basketball/nba']) {
  const news = await json(`${S}/${sport}/news?limit=5`);
  const a = news?.articles?.[0];
  console.log(`\n##### ${sport} story text for: ${a?.headline}`);
  console.log('article keys:', Object.keys(a || {}).join(','), '| api link:', a?.links?.api?.self?.href, '| type', a?.type);
  const id = a?.id ?? a?.dataSourceIdentifier;
  for (const url of [a?.links?.api?.self?.href, `https://now.core.api.espn.com/v1/sports/news/${id}`, `https://site.api.espn.com/apis/site/v2/sports/${sport}/news/${id}`].filter(Boolean)) {
    const r = await get(url.replace('http://', 'https://'));
    let story = '';
    try { const j = JSON.parse(r.text); story = j.headlines?.[0]?.story || j.story || ''; } catch {}
    console.log(`${r.status} ${url} story chars=${decode(story).length} | ${decode(story).slice(0, 200)}`);
  }
}
