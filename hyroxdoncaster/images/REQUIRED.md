# Image contract — chassis

This site ships with no photography. To build a tenant, drop these
files into its assets folder (same names, any real photo per slot):

- images/avatar.jpg
- images/bike.jpg
- images/bio.jpg
- images/carry.jpg
- images/coaching-hero.jpg
- images/coaching.jpg
- images/detail.jpg
- images/doubles.jpg
- images/events-hero.jpg
- images/events-secondary.jpg
- images/finish.jpg
- images/gallery/dinner-template.jpg
- images/gallery/restaurant.jpg
- images/half.jpg
- images/hero.jpg
- images/hoodie.jpg
- images/kerb.jpg
- images/links-hero.jpg
- images/momentum.jpg
- images/night.jpg
- images/pb-venue.jpg
- images/pb.jpg
- images/predictor-hero.jpg
- images/race-mate-hero.jpg
- images/race-pair.jpg
- images/race-revel.jpg
- images/rooftop.jpg
- images/rope.jpg
- images/run-compromised.jpg
- images/run-hero.jpg
- images/skierg-laugh.jpg
- images/splits-hero.jpg
- images/sprint.jpg
- images/squad-athlos.jpg
- images/startline.jpg
- images/station-burpees.jpg
- images/station-farmers-carry.jpg
- images/station-lean.jpg
- images/station-row.jpg
- images/station-sandbag-lunges.jpg
- images/station-skierg.jpg
- images/station-sled-pull.jpg
- images/station-sled-push.jpg
- images/station-wall-balls.jpg
- images/stations-hero.jpg
- images/suit.jpg
- images/taper-hero.jpg
- images/track.jpg
- images/treadmill.jpg
- images/walkin.jpg
- images/wallball.jpg

Optional extras (gallery/, lifestyle) can be added per tenant; filenames
in pages are the contract — rename files to match, not the other way round.

Optional booking photo slot: `images/planner-watermark.jpg` — an approved portrait of the site's own coach. The neutral booking template has no watermark or portrait selected. A missing watermark never blocks a build; existing sites may reuse their own `bio.jpg`. No stock fallback is required. Set `booking.watermark` in the tenant build config to choose another local image, and `booking.timeZone` to override the default timezone.
