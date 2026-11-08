import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  prepareBookingTemplate,
  installBookingPlanner,
  bookingProfiles,
} from "./booking-planner.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
if (process.argv.includes("--from-pilot")) prepareBookingTemplate(root);
installBookingPlanner({ root, slug: "chassis", template: true });
const requested = process.argv.slice(2).filter((arg) => !arg.startsWith("--"));
const profiles = bookingProfiles(root).filter(
  ({ slug }) => !requested.length || requested.includes(slug),
);
for (const options of profiles) {
  const profile = installBookingPlanner({ root, ...options });
  console.log(
    `${profile.slug}: ${profile.coachFull} · ${profile.timeZone} · watermark ${profile.watermark ? "filled" : "empty"}`,
  );
}
console.log(
  `Booking preview installed: ${profiles.length} existing sites + blank-photo template. No real booking services enabled.`,
);
