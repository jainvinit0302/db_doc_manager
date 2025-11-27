import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Database } from "lucide-react";

const Signup = () => {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    // Validate passwords match
    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    // Validate password length
    if (password.length < 6) {
      setError("Password must be at least 6 characters long");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("/api/auth/signup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name, email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Signup failed");
        setLoading(false);
        return;
      }

      // Redirect to login page on success
      navigate("/login", {
        state: { message: "Account created successfully! Please log in." }
      });
    } catch (err: any) {
      setError(err.message === "Failed to fetch"
        ? "Unable to reach server. Is the backend running?"
        : "Signup failed. Please try again.");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full gradient-bg flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="glass-card rounded-2xl p-8 space-y-6">
          {/* Logo and Title */}
          <div className="text-center space-y-2">
            <div className="flex justify-center mb-4">
              <div className="w-16 h-16 rounded-xl bg-primary/10 flex items-center justify-center">
                <Database className="w-8 h-8 text-primary" />
              </div>
            </div>
            <h1 className="text-2xl font-bold text-foreground">Create Account</h1>
            <p className="text-sm text-muted-foreground">Join DBDocManager today</p>
          </div>

          {/* Signup Form */}
          <form onSubmit={handleSignup} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Full Name</Label>
              <Input
                id="name"
                type="text"
                placeholder="John Doe"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="bg-background/50"
                disabled={loading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="bg-background/50"
                disabled={loading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="bg-background/50"
                disabled={loading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                className="bg-background/50"
                disabled={loading}
              />
            </div>

            {error && (
              <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
                {error}
              </div>
            )}

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Creating Account..." : "Create Account"}
            </Button>
          </form>

          {/* Link to Login */}
          <div className="text-center text-sm text-muted-foreground">
            Already have an account?{" "}
            <button
              type="button"
              onClick={() => navigate("/login")}
              className="text-primary hover:underline"
            >
              Sign in
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-8 text-center text-xs text-muted-foreground">
          Made by Team-4 IIITH PG-1 | 2025
        </div>
      </div>
    </div>
  );
};

export default Signup;
