import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const escape = value => String(value).replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
const attribute = (tag, name) => tag.match(new RegExp(`\\b${name}="([^"]*)"`))?.[1];
const setAttribute = (tag, name, value) => {
  const attr = `${name}="${escape(value)}"`;
  return new RegExp(`\\b${name}="[^"]*"`).test(tag)
    ? tag.replace(new RegExp(`\\b${name}="[^"]*"`), () => attr)
    : tag.replace(/\s*\/?>$/, end => ` ${attr}${end}`);
};

export function framing(photo, frame) {
  if (!frame || frame.mode === 'existing' || frame.mode === 'element') return '';
  if (frame.mode === 'natural') return 'display:block!important;width:100%!important;height:auto!important;max-height:none!important;aspect-ratio:auto!important;object-fit:contain!important;';
  const [width, height] = photo.dims || [];
  if (!(width > 0 && height > 0 && frame.aspect > 0)) throw new Error('Crop needs photo dimensions and a positive frame aspect');
  const points = (photo.anchors?.mustKeep || []).flatMap(({box}) => [[box[0], box[1]], [box[2], box[3]]]);
  const faces = photo.anchors?.face;
  if (faces) for (const face of (Array.isArray(faces[0]) ? faces : [faces])) {
    points.push([Math.max(0, face[0] - .06), Math.max(0, face[1] - .08)], [Math.min(1, face[0] + .06), Math.min(1, face[1] + .08)]);
  }
  const axis = width / height < frame.aspect ? 1 : 0;
  const visible = axis ? width / height / frame.aspect : frame.aspect / (width / height);
  let position = 50;
  if (points.length && visible < 1) {
    const low = Math.min(...points.map(p => p[axis]));
    const high = Math.max(...points.map(p => p[axis]));
    if (high - low > visible + .000001) throw new Error('Must-keep content cannot fit this frame; choose a taller/wider frame or natural proportions');
    const offset = Math.max(0, Math.min(1 - visible, (low + high - visible) / 2));
    position = offset / (1 - visible) * 100;
  }
  return `display:block!important;width:100%!important;height:auto!important;max-height:none!important;aspect-ratio:${frame.aspect}!important;object-fit:cover!important;object-position:${axis ? 50 : position}% ${axis ? position : 50}%!important;`;
}

export function assertPhotoReviewReady(map) {
  if (map.review?.status === 'needs-user-eye') {
    const slots = (map.review.items || []).map(item => item.slot).filter(Boolean).join(', ');
    throw new Error(`PHOTO REVIEW PAUSED${slots ? ': ' + slots : ''}. Show Chris the existing screenshots and at most two candidates. Do not retry or clear this flag without his decision.`);
  }
}

export function applyPhotoMap({mapPath, outputDir, check = false, requireComplete = false}) {
  const map = JSON.parse(fs.readFileSync(mapPath, 'utf8'));
  assertPhotoReviewReady(map);
  if (!Array.isArray(map.placements)) throw new Error('Photo map has no placements; initialise it first');
  const seen = new Set(), placementIdentities = new Map(), changes = new Map();
  const base = `/${map.tenant}/images/`;
  for (const slot of map.placements) {
    if (seen.has(slot.id)) throw new Error(`Duplicate slot: ${slot.id}`);
    seen.add(slot.id);
    const photo = map.images[slot.file];
    if (!photo) throw new Error(`Unmapped image: ${slot.file}`);
    if (!fs.existsSync(path.join(outputDir, 'images', slot.file))) throw new Error(`Missing image: ${slot.file}`);
    if (slot.role !== 'decorative') {
      const identity = photo.identity || slot.file;
      if (placementIdentities.has(identity) && !slot.reuseReason) throw new Error(`Photo reuse: ${slot.id} and ${placementIdentities.get(identity)}; change the map or record reuseReason`);
      placementIdentities.set(identity, slot.id);
    }
  }
  for (const binding of map.dataPlacements || []) {
    if (!map.images[binding.file] || !fs.existsSync(path.join(outputDir, 'images', binding.file))) throw new Error(`Unmapped/missing data photo: ${binding.file}`);
    const identity = map.images[binding.file].identity || binding.file;
    if (placementIdentities.has(identity) && !binding.reuseReason)
      throw new Error(`Photo reuse: ${binding.json}#${binding.index} (${binding.page}) shares ${binding.file} with ${placementIdentities.get(identity)}; record reuseReason or change the map`);
    placementIdentities.set(identity, `${binding.json}#${binding.index}`);
    if (binding.json.includes('..') || !binding.json.startsWith('data/')) throw new Error('Invalid data path');
    const target = path.join(outputDir, binding.json);
    const data = JSON.parse(changes.get(target) || fs.readFileSync(target, 'utf8'));
    data[binding.index][binding.field] = base + binding.file;
    changes.set(target, JSON.stringify(data, null, 2) + '\n');
  }
  const pages = new Set(map.placements.map(p => p.page));
  if (requireComplete) {
    for (const page of fs.readdirSync(outputDir).filter(f => f.endsWith('.html'))) {
      if (fs.readFileSync(path.join(outputDir, page), 'utf8').includes(base)) pages.add(page);
    }
    const feedPath = path.join(outputDir, 'data/desk/prep-club-feed.json');
    if (fs.existsSync(path.join(outputDir, 'prep-club.html')) && fs.existsSync(feedPath)) {
      const feed = JSON.parse(fs.readFileSync(feedPath, 'utf8'));
      for (const [index, item] of feed.entries()) if (item.img?.startsWith(base) && !(map.dataPlacements || []).some(b => b.json === 'data/desk/prep-club-feed.json' && b.index === index && b.field === 'img')) throw new Error(`Unassigned Prep Club feed photo: ${index}`);
    }
  }
  for (const page of pages) {
    if (path.basename(page) !== page || !page.endsWith('.html')) throw new Error(`Invalid page: ${page}`);
    const target = path.join(outputDir, page);
    let html = fs.readFileSync(target, 'utf8');
    let ordinal = 0;
    const matched = new Set(), rules = [];
    html = html.replace(/<img\b[^>]*>/gi, tag => {
      const src = attribute(tag, 'src');
      if (!src?.startsWith(base)) return tag;
      const id = attribute(tag, 'data-photo-slot') || `${page}:${ordinal}`;
      ordinal++;
      const slot = map.placements.find(p => p.page === page && p.id === id);
      if (!slot) throw new Error(`Unassigned photo slot: ${id}`);
      matched.add(id);
      const photo = map.images[slot.file];
      const version = src.includes('?') ? src.slice(src.indexOf('?')) : '';
      tag = setAttribute(tag, 'src', base + slot.file + version);
      tag = setAttribute(tag, 'data-photo-slot', id);
      tag = setAttribute(tag, 'alt', slot.alt);
      if (photo.dims) {
        tag = setAttribute(tag, 'width', photo.dims[0]);
        tag = setAttribute(tag, 'height', photo.dims[1]);
      }
      const selector = `html body img[data-photo-slot="${id}"]`;
      const desktop = framing(photo, slot.frame);
      if (desktop) {
        rules.push(`${selector}{${desktop}}`);
        rules.push(`html body figure:has(>img[data-photo-slot="${id}"]){height:auto!important;max-height:none!important;aspect-ratio:auto!important;}`);
        rules.push(`@media(max-width:600px){${selector}{${framing(photo, slot.mobileFrame || slot.frame)}}}`);
      }
      return tag;
    });
    for (const slot of map.placements.filter(p => p.page === page)) if (!matched.has(slot.id)) throw new Error(`Slot missing from page: ${slot.id}`);
    for (const binding of (map.dataPlacements || []).filter(b => b.page === page)) {
      const selector = `html body ${binding.container} img[src^="${base + binding.file}"]`;
      rules.push(`${selector}{${framing(map.images[binding.file], binding.frame)}}`);
      if (binding.mobileFrame) rules.push(`@media(max-width:600px){${selector}{${framing(map.images[binding.file], binding.mobileFrame)}}}`);
    }
    html = html.replace(/<style id="photo-map-layout">[\s\S]*?<\/style>/g, '');
    html = html.replace('</head>', `<style id="photo-map-layout">${rules.join('\n')}</style></head>`);
    if (html !== fs.readFileSync(target, 'utf8')) changes.set(target, html);
  }
  if (map.wall) {
    const photos = map.wall.map(({file, ...entry}) => {
      if (!map.images[file] || !fs.existsSync(path.join(outputDir, 'images', file))) throw new Error(`Unmapped/missing wall photo: ${file}`);
      return {src: base + file, ...entry};
    });
    changes.set(path.join(outputDir, 'data/gallery.json'), JSON.stringify({note:'PRIVATE PITCH PREVIEW.', photos}, null, 2) + '\n');
  }
  if (!check) {
    for (const [target, text] of changes) fs.writeFileSync(target, text);
    for (const photo of Object.values(map.images)) photo.usedOn = [];
    for (const slot of map.placements) map.images[slot.file].usedOn.push(slot.id);
    for (const binding of map.dataPlacements || []) map.images[binding.file].usedOn.push(`${binding.json}:${binding.index}`);
    for (const [index, photo] of (map.wall || []).entries()) map.images[photo.file].usedOn.push(`gallery wall:${index}`);
    fs.writeFileSync(mapPath, JSON.stringify(map, null, 2) + '\n');
  }
  return {slots: seen.size, pages: pages.size, coveredSlots: map.placements.map(p => p.chassisSlot).filter(Boolean), changed: [...changes.keys()]};
}

export function initialisePhotoMap(mapPath, outputDir) {
  const map = JSON.parse(fs.readFileSync(mapPath, 'utf8'));
  if (map.placements) throw new Error('Placements already exist; edit the map instead');
  map.placements = [];
  for (const page of fs.readdirSync(outputDir).filter(f => f.endsWith('.html')).sort()) {
    const html = fs.readFileSync(path.join(outputDir, page), 'utf8');
    let ordinal = 0;
    for (const match of html.matchAll(/<img\b[^>]*>/gi)) {
      const tag = match[0], src = attribute(tag, 'src'), base = `/${map.tenant}/images/`;
      if (!src?.startsWith(base)) continue;
      const file = src.slice(base.length).split('?')[0];
      map.images[file] ||= {rating:3, subject:'Needs review', anchors:{}, usedOn:[]};
      const before = html.slice(Math.max(0, match.index - 250), match.index);
      map.placements.push({id:`${page}:${ordinal++}`, page, role:/<figure[^>]*guide-hero-photo[^>]*>\s*$/.test(before) ? 'hero' : 'photo', file, alt:attribute(tag, 'alt') || '', frame:{mode:'existing'}});
    }
  }
  const gallery = JSON.parse(fs.readFileSync(path.join(outputDir, 'data/gallery.json'), 'utf8'));
  map.wall = gallery.photos.map(({src, ...entry}) => ({file:src.split('/images/')[1], ...entry}));
  for (const photo of Object.values(map.images)) photo.usedOn = [];
  for (const slot of map.placements) map.images[slot.file].usedOn.push(slot.id);
  fs.writeFileSync(mapPath, JSON.stringify(map, null, 2) + '\n');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [, , mapPath, outputDir, flag] = process.argv;
  if (flag === '--init') initialisePhotoMap(mapPath, outputDir);
  else console.log(applyPhotoMap({mapPath, outputDir, check:flag === '--check'}));
}
