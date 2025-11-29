import React, { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/auth/AuthProvider";
import NavigationHeader from "@/components/NavigationHeader";
import { useNavigate } from "react-router-dom";
import {
    Activity,
    Calendar,
    CheckCircle2,
    Database,
    LogIn,
    Mail,
    User as UserIcon,
    Shield
} from "lucide-react";

interface UserProfile {
    id: number;
    email: string;
    name: string;
    created_at: string;
}

interface UserStats {
    login_count: number;
    validation_count: number;
    generation_count: number;
    last_active: string;
}

const Profile = () => {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [stats, setStats] = useState<UserStats | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchProfile = async () => {
            try {
                const token = localStorage.getItem("authToken");
                if (!token) throw new Error("No token found");

                const res = await fetch("/api/profile", {
                    headers: { Authorization: `Bearer ${token}` }
                });

                if (!res.ok) {
                    const errorData = await res.json().catch(() => ({}));
                    throw new Error(errorData.error || `Failed to fetch profile (${res.status})`);
                }

                const data = await res.json();
                setProfile(data.user);
                setStats(data.stats);
            } catch (err) {
                if (err instanceof Error) {
                    setError(err.message);
                } else {
                    setError("An unknown error occurred");
                }
            } finally {
                setLoading(false);
            }
        };

        fetchProfile();
    }, []);

    if (loading) {
        return (
            <div className="min-h-screen bg-background flex flex-col">
                <NavigationHeader projectName="Profile" onBack={() => navigate("/dashboard")} />
                <div className="flex-1 flex items-center justify-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen bg-background flex flex-col">
                <NavigationHeader projectName="Profile" onBack={() => navigate("/dashboard")} />
                <div className="flex-1 flex items-center justify-center">
                    <Card className="max-w-md">
                        <CardHeader>
                            <CardTitle className="text-red-600">Error Loading Profile</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <p className="text-sm text-muted-foreground">{error}</p>
                            {error.includes("404") && (
                                <div className="p-3 bg-amber-50 border border-amber-200 rounded text-sm">
                                    <p className="text-amber-800">
                                        Your session may be outdated. Please log out and log in again to refresh your account.
                                    </p>
                                </div>
                            )}
                            <div className="flex gap-2">
                                <Button onClick={() => navigate("/dashboard")} variant="outline">
                                    Back to Dashboard
                                </Button>
                                <Button onClick={() => logout()} variant="destructive">
                                    Log Out
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background flex flex-col">
            <NavigationHeader projectName="User Profile" onBack={() => navigate("/dashboard")} />

            <main className="flex-1 container max-w-4xl mx-auto py-8 px-4">
                {/* Header Section */}
                <div className="flex flex-col md:flex-row items-center gap-6 mb-8">
                    <Avatar className="h-24 w-24 border-4 border-muted">
                        <AvatarFallback className="text-2xl bg-primary/10 text-primary">
                            {profile?.name?.charAt(0).toUpperCase() || "U"}
                        </AvatarFallback>
                    </Avatar>
                    <div className="text-center md:text-left space-y-2">
                        <h1 className="text-3xl font-bold">{profile?.name}</h1>
                        <div className="flex items-center justify-center md:justify-start gap-2 text-muted-foreground">
                            <Mail className="w-4 h-4" />
                            <span>{profile?.email}</span>
                        </div>
                        <div className="flex items-center justify-center md:justify-start gap-2 text-xs text-muted-foreground">
                            <Calendar className="w-3 h-3" />
                            <span>Joined {new Date(profile?.created_at || "").toLocaleDateString()}</span>
                        </div>
                    </div>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Total Logins</CardTitle>
                            <LogIn className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{stats?.login_count || 0}</div>
                            <p className="text-xs text-muted-foreground">
                                Times you've accessed the platform
                            </p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Validations Run</CardTitle>
                            <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{stats?.validation_count || 0}</div>
                            <p className="text-xs text-muted-foreground">
                                Successful DSL validations
                            </p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Artifacts Generated</CardTitle>
                            <Database className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{stats?.generation_count || 0}</div>
                            <p className="text-xs text-muted-foreground">
                                SQL, ERD, and Lineage generations
                            </p>
                        </CardContent>
                    </Card>
                </div>

                {/* Activity Section */}
                <Card className="mb-8">
                    <CardHeader>
                        <div className="flex items-center gap-2">
                            <Activity className="w-5 h-5 text-primary" />
                            <CardTitle>Recent Activity</CardTitle>
                        </div>
                        <CardDescription>
                            Your latest interaction with the platform
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-center gap-4 p-4 bg-muted/30 rounded-lg">
                            <div className="p-2 bg-primary/10 rounded-full">
                                <Shield className="w-5 h-5 text-primary" />
                            </div>
                            <div>
                                <p className="font-medium">Last Active Session</p>
                                <p className="text-sm text-muted-foreground">
                                    {stats?.last_active
                                        ? new Date(stats.last_active).toLocaleString()
                                        : "No activity recorded"}
                                </p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </main>
        </div>
    );
};

export default Profile;
