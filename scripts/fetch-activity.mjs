// Fetches contribution data for the activity card. Needs GH_TOKEN (the Action provides one).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const here = path.dirname(fileURLToPath(import.meta.url));
const login = process.env.GH_USER || "SherazAhmad17";
const query = `query($login:String!){user(login:$login){
  followers{totalCount}
  repositories(ownerAffiliations:[OWNER],privacy:PUBLIC,isFork:false,first:100){totalCount nodes{stargazerCount}}
  contributionsCollection{contributionCalendar{totalContributions weeks{contributionDays{date contributionCount weekday}}}}
}}`;
const res = await fetch("https://api.github.com/graphql", {
  method: "POST",
  headers: { Authorization: `Bearer ${process.env.GH_TOKEN}`, "Content-Type": "application/json" },
  body: JSON.stringify({ query, variables: { login } }),
});
const j = await res.json();
if (!j.data?.user) { console.error("GraphQL error", JSON.stringify(j.errors || j).slice(0, 300)); process.exit(1); }
const u = j.data.user, cal = u.contributionsCollection.contributionCalendar;
fs.writeFileSync(path.join(here, "activity-data.json"), JSON.stringify({
  total: cal.totalContributions, repos: u.repositories.totalCount, followers: u.followers.totalCount,
  stars: u.repositories.nodes.reduce((a, n) => a + n.stargazerCount, 0),
  weeks: cal.weeks.map(w => w.contributionDays.map(d => [d.date, d.contributionCount, d.weekday])),
}));
console.log("activity-data.json written:", cal.totalContributions, "contributions");
