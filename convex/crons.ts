import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";
const crons=cronJobs();
crons.interval("Check due purchases",{hours:6},internal.monitoring.checkDue,{});
crons.interval("Refresh sample product prices",{hours:6},internal.catalog.refresh,{});
export default crons;
