import { lazy, Suspense } from "react";
import { Route, Routes } from "react-router-dom";
import { UserApp } from "./UserApp";
import { PageSkeleton } from "./components/PageSkeleton";

const AdminApp = lazy(() => import("./admin/AdminApp"));

export function App() {
  return (
    <Routes>
      <Route
        path="/admin/*"
        element={
          <Suspense fallback={<div className="min-h-screen bg-bg" />}>
            <AdminApp />
          </Suspense>
        }
      />
      <Route
        path="/*"
        element={
          <Suspense fallback={<PageSkeleton />}>
            <UserApp />
          </Suspense>
        }
      />
    </Routes>
  );
}
