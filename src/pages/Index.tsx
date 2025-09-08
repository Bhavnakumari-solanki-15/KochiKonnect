import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Train, Upload, BarChart3, Database, Zap, Shield } from "lucide-react";
import { Link } from "react-router-dom";

const Index = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-secondary/20">
      <div className="container mx-auto px-4 py-16">
        {/* Hero Section */}
        <div className="text-center space-y-6 mb-16">
          <div className="flex justify-center mb-4">
            <Train className="w-16 h-16 text-primary" />
          </div>
          <h1 className="text-4xl md:text-6xl font-bold text-foreground">
            KochiKonnect
          </h1>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
            Metro Operations Suite - Optimize fleet deployment with intelligent ranking and constraint-based scheduling
          </p>
          <div className="flex gap-4 justify-center">
            <Button asChild size="lg">
              <Link to="/upload">
                <Upload className="w-5 h-5 mr-2" />
                Upload Data
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link to="/dashboard">
                <BarChart3 className="w-5 h-5 mr-2" />
                View Dashboard
              </Link>
            </Button>
          </div>
        </div>

        {/* Features Grid */}
        <div className="grid md:grid-cols-3 gap-6 mb-16">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="w-5 h-5 text-primary" />
                Data Management
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                Upload and manage fitness certificates, job cards, mileage logs, and maintenance schedules in one place.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="w-5 h-5 text-primary" />
                Smart Optimization
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                AI-powered scoring algorithm considers safety, maintenance, branding priorities, and operational constraints.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-primary" />
                Safety First
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                Automatic exclusion of trains with expired fitness certificates or critical maintenance issues.
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Process Overview */}
        <div className="text-center space-y-8">
          <h2 className="text-3xl font-bold text-foreground">How It Works</h2>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="space-y-4">
              <div className="w-12 h-12 bg-primary rounded-full flex items-center justify-center mx-auto">
                <span className="text-primary-foreground font-bold">1</span>
              </div>
              <h3 className="text-xl font-semibold">Upload Data</h3>
              <p className="text-muted-foreground">
                Import train data, maintenance records, and operational parameters via CSV, Excel, or manual entry.
              </p>
            </div>
            <div className="space-y-4">
              <div className="w-12 h-12 bg-primary rounded-full flex items-center justify-center mx-auto">
                <span className="text-primary-foreground font-bold">2</span>
              </div>
              <h3 className="text-xl font-semibold">Analyze & Rank</h3>
              <p className="text-muted-foreground">
                Our constraint engine applies safety rules and optimization algorithms to rank trains for deployment.
              </p>
            </div>
            <div className="space-y-4">
              <div className="w-12 h-12 bg-primary rounded-full flex items-center justify-center mx-auto">
                <span className="text-primary-foreground font-bold">✓</span>
              </div>
              <h3 className="text-xl font-semibold">Deploy Optimally</h3>
              <p className="text-muted-foreground">
                Get ranked recommendations with conflict alerts and audit logging for transparent decision making.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Index;
