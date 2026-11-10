Track every rave, venue, artist, memnory.

Platforms:
- iphone
- Android
- Web

## Local Development

Install dependencies separately in each package:

```sh
cd frontend && npm install
cd ../backend && npm install
```

Start the Express API in one terminal:

```sh
cd backend
npm run dev
```

Start the Expo app in another terminal:

```sh
cd frontend
npm start
```

The frontend uses bundled mock events and venues when `EXPO_PUBLIC_API_URL` is unset. To use the local Express API, copy `frontend/.env.example` to `frontend/.env` and set `EXPO_PUBLIC_API_URL` to the backend origin, for example `http://localhost:3000`. On a physical phone, use the computer's LAN address instead of `localhost`, then restart Expo so the public environment variable is reloaded.

The backend currently serves in-memory mock event and venue data. It is intended for development and does not provide durable event persistence. The Night journal remains stored locally on the device through AsyncStorage.

Useful checks:

```sh
cd frontend && npm run typecheck
cd backend && npm run build
```