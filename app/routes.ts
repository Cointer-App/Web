import { type RouteConfig, index, layout, route } from "@react-router/dev/routes";

export default [
  layout("routes/_app.tsx", [
    index("routes/dashboard.tsx"),
    route("activity", "routes/activity.tsx"),
    route("channels", "routes/channels.tsx"),
    route("settings", "routes/settings.tsx"),
  ]),
  route("login", "routes/login.tsx"),
] satisfies RouteConfig;
