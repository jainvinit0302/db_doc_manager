import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Database, GitBranch, FileText, Zap, ArrowRight, CheckCircle } from "lucide-react";

const Landing = () => {
    const navigate = useNavigate();

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
            {/* Navigation Bar */}
            <nav className="fixed top-0 w-full bg-white/80 dark:bg-slate-900/80 backdrop-blur-md z-50 border-b border-slate-200 dark:border-slate-700">
                <div className="container mx-auto px-6 py-4 flex justify-between items-center">
                    <div className="flex items-center gap-2">
                        <Database className="w-8 h-8 text-blue-600" />
                        <span className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                            DBDocManager
                        </span>
                    </div>
                    <div className="flex gap-3">
                        <Button variant="ghost" onClick={() => navigate("/login")}>
                            Login
                        </Button>
                        <Button onClick={() => navigate("/signup")} className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700">
                            Get Started
                        </Button>
                    </div>
                </div>
            </nav>

            {/* Hero Section */}
            <section className="pt-32 pb-20 px-6">
                <div className="container mx-auto text-center max-w-5xl">
                    <div className="animate-fade-in-up">
                        <h1 className="text-5xl md:text-7xl font-bold mb-6 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 bg-clip-text text-transparent leading-tight">
                            Document Your Data,
                            <br />
                            Visualize Your Flow
                        </h1>
                        <p className="text-xl md:text-2xl text-slate-600 dark:text-slate-300 mb-8 max-w-3xl mx-auto">
                            DBDocManager transforms your database schemas into beautiful documentation,
                            ER diagrams, and data lineage visualizations—all from a simple DSL.
                        </p>
                        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
                            <Button
                                size="lg"
                                onClick={() => navigate("/signup")}
                                className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-lg px-8 py-6 group"
                            >
                                Start Free
                                <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
                            </Button>
                            <Button
                                size="lg"
                                variant="outline"
                                onClick={() => navigate("/login")}
                                className="text-lg px-8 py-6"
                            >
                                Sign In
                            </Button>
                        </div>
                    </div>

                    {/* Feature Pills */}
                    <div className="mt-12 flex flex-wrap justify-center gap-3">
                        {["DSL-Driven", "Auto ER Diagrams", "Data Lineage", "Multi-DB Support"].map((feature) => (
                            <div
                                key={feature}
                                className="px-4 py-2 rounded-full bg-white/70 dark:bg-slate-800/70 backdrop-blur border border-slate-200 dark:border-slate-700 text-sm font-medium text-slate-700 dark:text-slate-300 flex items-center gap-2"
                            >
                                <CheckCircle className="w-4 h-4 text-green-500" />
                                {feature}
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Features Section */}
            <section className="py-20 px-6 bg-white/50 dark:bg-slate-900/50 backdrop-blur">
                <div className="container mx-auto max-w-6xl">
                    <h2 className="text-4xl md:text-5xl font-bold text-center mb-4 bg-gradient-to-r from-slate-800 to-slate-600 dark:from-slate-100 dark:to-slate-300 bg-clip-text text-transparent">
                        Powerful Features
                    </h2>
                    <p className="text-center text-slate-600 dark:text-slate-400 mb-16 max-w-2xl mx-auto">
                        Everything you need to document, visualize, and understand your data architecture
                    </p>

                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
                        {/* Feature 1 */}
                        <Card className="group hover:shadow-2xl transition-all duration-300 hover:-translate-y-2 border-2 border-transparent hover:border-blue-200 dark:hover:border-blue-800">
                            <CardContent className="pt-6">
                                <div className="w-14 h-14 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                                    <FileText className="w-7 h-7 text-white" />
                                </div>
                                <h3 className="text-xl font-bold mb-3 text-slate-800 dark:text-slate-100">
                                    DSL-Driven Documentation
                                </h3>
                                <p className="text-slate-600 dark:text-slate-400">
                                    Write your schema once in our intuitive DSL. Generate comprehensive documentation automatically.
                                </p>
                            </CardContent>
                        </Card>

                        {/* Feature 2 */}
                        <Card className="group hover:shadow-2xl transition-all duration-300 hover:-translate-y-2 border-2 border-transparent hover:border-purple-200 dark:hover:border-purple-800">
                            <CardContent className="pt-6">
                                <div className="w-14 h-14 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                                    <Database className="w-7 h-7 text-white" />
                                </div>
                                <h3 className="text-xl font-bold mb-3 text-slate-800 dark:text-slate-100">
                                    Interactive ER Diagrams
                                </h3>
                                <p className="text-slate-600 dark:text-slate-400">
                                    Visualize your database relationships with beautiful, interactive entity-relationship diagrams.
                                </p>
                            </CardContent>
                        </Card>

                        {/* Feature 3 */}
                        <Card className="group hover:shadow-2xl transition-all duration-300 hover:-translate-y-2 border-2 border-transparent hover:border-green-200 dark:hover:border-green-800">
                            <CardContent className="pt-6">
                                <div className="w-14 h-14 rounded-lg bg-gradient-to-br from-green-500 to-emerald-500 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                                    <GitBranch className="w-7 h-7 text-white" />
                                </div>
                                <h3 className="text-xl font-bold mb-3 text-slate-800 dark:text-slate-100">
                                    Data Lineage Tracking
                                </h3>
                                <p className="text-slate-600 dark:text-slate-400">
                                    Trace data flow from source to target. Understand transformations and dependencies.
                                </p>
                            </CardContent>
                        </Card>

                        {/* Feature 4 */}
                        <Card className="group hover:shadow-2xl transition-all duration-300 hover:-translate-y-2 border-2 border-transparent hover:border-orange-200 dark:hover:border-orange-800">
                            <CardContent className="pt-6">
                                <div className="w-14 h-14 rounded-lg bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                                    <Zap className="w-7 h-7 text-white" />
                                </div>
                                <h3 className="text-xl font-bold mb-3 text-slate-800 dark:text-slate-100">
                                    Multi-Database Support
                                </h3>
                                <p className="text-slate-600 dark:text-slate-400">
                                    Generate SQL for PostgreSQL, MongoDB, Snowflake, and more—all from one DSL.
                                </p>
                            </CardContent>
                        </Card>

                        {/* Feature 5 */}
                        <Card className="group hover:shadow-2xl transition-all duration-300 hover:-translate-y-2 border-2 border-transparent hover:border-cyan-200 dark:hover:border-cyan-800">
                            <CardContent className="pt-6">
                                <div className="w-14 h-14 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-500 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                                    <CheckCircle className="w-7 h-7 text-white" />
                                </div>
                                <h3 className="text-xl font-bold mb-3 text-slate-800 dark:text-slate-100">
                                    Validation & Testing
                                </h3>
                                <p className="text-slate-600 dark:text-slate-400">
                                    Built-in validation ensures your schema is correct before deployment.
                                </p>
                            </CardContent>
                        </Card>

                        {/* Feature 6 */}
                        <Card className="group hover:shadow-2xl transition-all duration-300 hover:-translate-y-2 border-2 border-transparent hover:border-indigo-200 dark:hover:border-indigo-800">
                            <CardContent className="pt-6">
                                <div className="w-14 h-14 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-500 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                                    <ArrowRight className="w-7 h-7 text-white" />
                                </div>
                                <h3 className="text-xl font-bold mb-3 text-slate-800 dark:text-slate-100">
                                    CI/CD Integration
                                </h3>
                                <p className="text-slate-600 dark:text-slate-400">
                                    Integrate seamlessly with your CI/CD pipeline using GitHub Actions.
                                </p>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </section>

            {/* CTA Section */}
            <section className="py-20 px-6">
                <div className="container mx-auto max-w-4xl text-center">
                    <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-3xl p-12 md:p-16 shadow-2xl">
                        <h2 className="text-3xl md:text-5xl font-bold text-white mb-6">
                            Ready to Transform Your Database Documentation?
                        </h2>
                        <p className="text-xl text-blue-100 mb-8 max-w-2xl mx-auto">
                            Join developers who are streamlining their data architecture with DBDocManager.
                        </p>
                        <Button
                            size="lg"
                            onClick={() => navigate("/signup")}
                            className="bg-white text-blue-600 hover:bg-slate-100 text-lg px-10 py-6 group"
                        >
                            Get Started Free
                            <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
                        </Button>
                    </div>
                </div>
            </section>

            {/* Footer */}
            <footer className="py-8 px-6 bg-slate-900 text-slate-400">
                <div className="container mx-auto text-center">
                    <p className="text-sm">
                        © {new Date().getFullYear()} DBDocManager. Built by IIITH Students.
                    </p>
                </div>
            </footer>

            <style>{`
        @keyframes fade-in-up {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .animate-fade-in-up {
          animation: fade-in-up 0.8s ease-out;
        }
      `}</style>
        </div>
    );
};

export default Landing;
