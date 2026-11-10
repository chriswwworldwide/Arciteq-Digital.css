import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {assertPhotoReviewReady} from './apply.mjs';

export function setupPhotoMap({root, configPath}) {
  const cfg = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  if (cfg.mode !== 'chassis' || !/^[a-z][a-z0-9-]{1,48}$/.test(cfg.slug || '')) throw new Error('Photo setup requires a valid canonical chassis tenant config');
  const assets = [cfg.assets].flat().filter(Boolean)[0];
  if (!assets) throw new Error('Set the tenant assets directory before photo intake');
  const assetPath = path.resolve(root, assets);
  if (path.dirname(assetPath) === root && fs.existsSync(path.join(assetPath, 'index.html'))) throw new Error('A generated tenant cannot be a new build asset source');
  const mapPath = path.resolve(root, cfg.photoMap || path.join(assets, 'photo-map.json'));
  if (fs.existsSync(mapPath)) {
    const existing = JSON.parse(fs.readFileSync(mapPath, 'utf8'));
    if (existing.tenant !== cfg.slug) throw new Error('Photo map tenant does not match config');
  } else {
    const placements = [];
    const omitted = new Set((cfg.omitImageSlots || []).map(f => f.replace(/^images\//, '')));
    const pages = new Set([...fs.readdirSync(path.join(root, 'chassis')).filter(f => f.endsWith('.html')), ...Object.keys(cfg.pageFiles || {})]);
    for (const page of pages) {
      if ((cfg.stripPages || []).includes(page)) continue;
      const spec = cfg.pageFiles?.[page];
      const html = spec ? (spec.startsWith('@') ? fs.readFileSync(path.resolve(root, spec.slice(1)), 'utf8') : spec) : fs.readFileSync(path.join(root, 'chassis', page), 'utf8');
      let ordinal = 0;
      for (const match of html.matchAll(/<img\b[^>]*src="\/([^/]+)\/images\/([^"?]+)[^>]*>/g)) {
        if (![cfg.slug, '{{SLUG}}'].includes(match[1]) || omitted.has(match[2])) continue;
        placements.push({id:`${page}:${ordinal++}`, page, chassisSlot:match[2], role:'photo', file:null, alt:'', frame:{mode:'natural'}});
      }
    }
    const feedPath = path.join(root, 'chassis/data/desk/prep-club-feed.json');
    const feed = fs.existsSync(feedPath) ? JSON.parse(fs.readFileSync(feedPath, 'utf8')) : [];
    const dataPlacements = (cfg.stripPages || []).includes('prep-club.html') ? [] : feed.map((item,index) => ({json:'data/desk/prep-club-feed.json', index, field:'img', chassisSlot:item.img.split('/images/')[1], file:null, page:'prep-club.html', container:'#prep-feed', frame:{mode:'natural'}, reuseReason:'Navigation card for its linked page'}));
    fs.mkdirSync(path.dirname(mapPath), {recursive:true});
    fs.writeFileSync(mapPath, JSON.stringify({tenant:cfg.slug, intakeComplete:false, images:{}, placements, wall:[], dataPlacements}, null, 2) + '\n');
  }
  cfg.photoMap = path.relative(root, mapPath);
  fs.writeFileSync(configPath, JSON.stringify(cfg, null, 2) + '\n');
  return mapPath;
}

export function configurePhotoMap({root, config, existing}) {
  if (existing) {
    const mapPath = config.photoMap ? path.resolve(root, config.photoMap) : null;
    if (mapPath) assertPhotoReviewReady(JSON.parse(fs.readFileSync(mapPath, 'utf8')));
    return mapPath;
  }
  const mapPath = path.resolve(root, config.photoMap || path.join([config.assets].flat().filter(Boolean)[0] || `scripts/reskin/${config.slug}-assets`, 'photo-map.json'));
  if (!fs.existsSync(mapPath)) throw new Error('New builds require a photo map. Run node scripts/photo-map/setup.mjs <config.json> before photo intake.');
  const map = JSON.parse(fs.readFileSync(mapPath, 'utf8'));
  assertPhotoReviewReady(map);
  if (map.tenant !== config.slug) throw new Error('Photo map tenant does not match config');
  if (map.intakeComplete !== true) throw new Error('Photo intake is not complete. Map every batch and wait for Chris to say "that is all" before allocating/building.');
  if (!map.placements?.length || !Array.isArray(map.wall) || !map.wall.length || !Array.isArray(map.dataPlacements)) throw new Error('New photo maps need static placements, explicit wall selections and data placements');
  const selected = [...map.placements, ...map.wall, ...map.dataPlacements];
  for (const slot of selected) {
    const photo = map.images?.[slot.file];
    if (!photo || photo.reviewed !== true || !photo.subject || !Number.isInteger(photo.rating) || photo.rating < 1 || photo.rating > 5 || !photo.dims?.every(n => Number.isFinite(n) && n > 0) || photo.dims.length !== 2 || !Array.isArray(photo.anchors?.mustKeep)) throw new Error(`Unreviewed or incomplete photo: ${slot.file || slot.id || 'unassigned slot'}`);
    if (slot.id && slot.role !== 'decorative' && !slot.alt?.trim()) throw new Error(`Photo alt text required: ${slot.id}`);
    if (slot.page && (!slot.frame || slot.frame.mode === 'existing' || slot.mobileFrame?.mode === 'existing')) throw new Error(`Explicit framing required: ${slot.id || slot.file}`);
    if (slot.frame?.mode === 'element' && !slot.frameNote?.trim()) throw new Error(`Element-framed slot needs a frameNote explaining which chassis rule sizes it: ${slot.id}`);
  }
  config.photoMap = path.relative(root, mapPath);
  config.strictImages = true;
  config.imageMap = {};
  for (const slot of [...map.placements, ...map.dataPlacements]) if (slot.chassisSlot) config.imageMap[slot.chassisSlot] ||= slot.file;
  return mapPath;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
  if (!process.argv[2]) throw new Error('Usage: node scripts/photo-map/setup.mjs <config.json>');
  console.log('Photo intake ready:', setupPhotoMap({root, configPath:path.resolve(process.argv[2])}));
}
