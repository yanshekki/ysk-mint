import { createBrowserRouter } from "react-router-dom";
import { Shell } from "./Shell.tsx";
import { HomePage } from "../features/home/HomePage.tsx";
import { CreatePage } from "../features/wizard/CreatePage.tsx";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <Shell />,
    children: [
      { index: true, element: <HomePage /> },
      { path: "create", element: <CreatePage /> },
    ],
  },
]);
