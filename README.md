# Getting Started with Create React App

## Project Notes (Interview Focus)

This app is a lightweight real-time dashboard demo. It uses:
- A simple WebSocket server in `server/server.js` for in-memory incidents and live readings.
- A hash-based router so we can show list, create, and detail pages without extra libraries.
- CSS-only chart bars to visualize incident temperature over time.

The source is split into:
- `src/logicalComponents` for stateful logic and page flows.
- `src/stylingComponents` for presentational components.

## Bootstrap, Build, and Runtime Notes

This project was created with Create React App (CRA) using the TypeScript template.
CRA provides the dev server, production build pipeline, and TypeScript tooling out of the box.

Key scripts:
- `npm start` runs the CRA dev server (hot reload, TypeScript checking).
- `npm run server` starts the local WebSocket server that powers real-time updates.

How it compiles:
- CRA uses `react-scripts` to compile TypeScript, bundle modules, and handle CSS/Sass.
- SCSS is compiled by the `sass` package and then processed by CRA's build pipeline.

Testing note:
- The single unit test focuses on the incident bucketing/filter logic because it is pure business logic that directly affects which list items appear in, without coupling to UI rendering.

Testing framework:
- Create React App ships with Jest as the test runner (via `react-scripts test`), and we use React Testing Library for component-level tests.
- `@types/jest` and `@testing-library/jest-dom` add TypeScript and DOM matchers (`describe`, `it`, `expect`, `toBeInTheDocument`).

Routing note:
- React Router v6/v7 introduces nested route trees (`Routes`/`Outlet`) and configuration-based routers (`createBrowserRouter` + `createRoutesFromElements`). It also encourages hoisting error boundaries to the route level.
- For this interview demo we intentionally keep a hash-based router to avoid extra dependencies and server configuration: hash routing works entirely in the browser, so we do not need to install React Router or configure the dev/prod server to rewrite all paths back to `index.html`. That keeps the project lightweight while still letting us explain route parsing and view selection in plain React.

How the server works:
- The server is a small Node process using the `ws` WebSocket library.
- It keeps incidents in memory, seeds historical readings, and emits updates at a fixed interval.
- The client subscribes once and then responds to `init`, `incidentAdded`, and `incidentUpdated` events.

This project was bootstrapped with [Create React App](https://github.com/facebook/create-react-app).

## Available Scripts

In the project directory, you can run:

### `npm start`

Runs the app in the development mode.\
Open [http://localhost:3000](http://localhost:3000) to view it in the browser.

The page will reload if you make edits.\
You will also see any lint errors in the console.

### `npm test`

Launches the test runner in the interactive watch mode.\
See the section about [running tests](https://facebook.github.io/create-react-app/docs/running-tests) for more information.

### `npm run build`

Builds the app for production to the `build` folder.\
It correctly bundles React in production mode and optimizes the build for the best performance.

The build is minified and the filenames include the hashes.\
Your app is ready to be deployed!

See the section about [deployment](https://facebook.github.io/create-react-app/docs/deployment) for more information.

### `npm run eject`

**Note: this is a one-way operation. Once you `eject`, you can’t go back!**

If you aren’t satisfied with the build tool and configuration choices, you can `eject` at any time. This command will remove the single build dependency from your project.

Instead, it will copy all the configuration files and the transitive dependencies (webpack, Babel, ESLint, etc) right into your project so you have full control over them. All of the commands except `eject` will still work, but they will point to the copied scripts so you can tweak them. At this point you’re on your own.

You don’t have to ever use `eject`. The curated feature set is suitable for small and middle deployments, and you shouldn’t feel obligated to use this feature. However we understand that this tool wouldn’t be useful if you couldn’t customize it when you are ready for it.

## Learn More

You can learn more in the [Create React App documentation](https://facebook.github.io/create-react-app/docs/getting-started).

To learn React, check out the [React documentation](https://reactjs.org/).
