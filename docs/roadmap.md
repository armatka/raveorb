# Roadmap

## Next steps

1. **Move the backend to Supabase Edge Functions.** Port the Express routes (events, locations, submissions, admin review) to Edge Functions and move the submissions store from the local SQLite file to Supabase Postgres. Keep the provider abstraction and the server-side Ticketmaster key. Pro plan at launch (~$25/month) — see [decisions.md](./decisions.md).
2. **Accounts and private backup, with in-app account deletion.** Optional sign-in; encrypted/private backup of device data (Nights, statuses, preferences, follows, plans) so a lost phone doesn't mean a lost journal. Account deletion must be available in the app and remove the backup.
3. **Opt-in community stats.** Aggregate, anonymized scene stats (e.g. busiest nights, popular styles per city) built only from users who opt in; anonymous contributions allowed — see [decisions.md](./decisions.md).

## Later ideas

- **More event sources** via the provider abstraction (`backend/src/providers/`), as sources with usable APIs/terms appear (several were evaluated and rejected — see [decisions.md](./decisions.md)).
- **Push notifications** for artist alerts and event changes (both are currently in-app only, refreshed at most every six hours).
- **Crew** — shared plans and night coordination with friends.
- **Sign in with Apple** once accounts exist.
- **Consumables log** — an optional, private harm-reduction log attached to Nights.
