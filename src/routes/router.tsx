// src/routes/router.tsx
import { createBrowserRouter } from "react-router-dom";
import { ProtectedRoute } from "./ProtectedRoute";
import { Login } from "../features/auth/Login";
import { Dashboard } from "../features/dashboard/Dashboard";
import { Earn } from "../features/earn/Earn";
import { Transfers } from "../features/transfers/Transfers";
import { Transactions } from "../features/transactions/Transactions";
import { Settings } from "../features/settings/Settings";
import { DashboardLayout } from "../layouts/DashboardLayout";

export const router = createBrowserRouter([
  {
    path: "/login",
    element: <Login />,
  },
  {
    path: "/",
    element: <ProtectedRoute />,
    children: [
      {
        index: true,
        element: (
          <DashboardLayout>
            <Dashboard />
          </DashboardLayout>
        ),
      },
      {
        path: "earn",
        element: <Earn />,
      },
      {
        path: "transfers",
        element: <Transfers />,
      },
      {
        path: "transactions",
        element: <Transactions />,
      },
      {
        path: "settings",
        element: <Settings />,
      },
    ],
  },
]);
