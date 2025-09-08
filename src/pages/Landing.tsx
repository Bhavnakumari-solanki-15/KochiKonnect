import { Link } from "react-router-dom";

const Landing = () => {
	return (
		<div className="min-h-screen flex flex-col items-center justify-center text-center px-6">
			<h1 className="text-4xl font-bold mb-4">Welcome to Kochi Metro</h1>
			<p className="text-muted-foreground mb-8 max-w-xl">
				This is the landing page. Use the navigation or the buttons below to explore
				the app.
			</p>
			<div className="flex gap-4">
				<Link
					to="/dashboard"
					className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground shadow hover:bg-primary/90 h-10 px-4 py-2"
				>
					Go to Dashboard
				</Link>
				<Link
					to="/upload"
					className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-10 px-4 py-2"
				>
					Upload CSV
				</Link>
			</div>
		</div>
	);
};

export default Landing;


