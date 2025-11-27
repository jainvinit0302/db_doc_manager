// src/components/ProtectedRoute.tsx
import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/auth/AuthProvider";

type Props = { children: React.ReactElement };

const ProtectedRoute: React.FC<Props> = ({ children }) => {
  const { isAuthenticated } = useAuth();
  const location = useLocation();

  if (!isAuthenticated) {
    // send user to /login and remember where they wanted to go
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return children;
};

export default ProtectedRoute;
