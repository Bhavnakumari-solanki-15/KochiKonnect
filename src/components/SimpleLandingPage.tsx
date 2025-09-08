import React from 'react'
import { motion } from 'framer-motion'
import { 
  Train, 
  BarChart3, 
  Shield,
  ArrowRight,
  CheckCircle2
} from 'lucide-react'

const SimpleLandingPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-white via-slate-50 to-slate-100 dark:from-slate-900 dark:via-blue-900 dark:to-slate-800">

      {/* Hero Section */}
      <section id="home" className="relative py-20 overflow-hidden min-h-screen flex items-center">
        {/* Background Image */}
        <div className="absolute inset-0">
          <img 
            src="/kmetro.avif"
            alt="Kochi Metro train at dusk with city lights"
            className="w-full h-full object-cover"
          />
          {/* Overlays for better text readability in both themes */}
          <div className="absolute inset-0 bg-gradient-to-r from-white/70 via-white/40 to-white/10 dark:from-slate-900/80 dark:via-slate-900/60 dark:to-slate-900/40"></div>
        </div>

        {/* Content */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="text-center">
            <motion.h1 
              className="text-4xl md:text-6xl lg:text-7xl font-bold text-gray-900 dark:text-white mb-6"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.2 }}
            >
              Welcome to{' '}
              <span className="bg-gradient-to-r from-blue-400 to-blue-300 bg-clip-text text-transparent">
                KochiKonnect
              </span>
            </motion.h1>
            
            <motion.p 
              className="text-xl md:text-2xl text-gray-700 dark:text-gray-300 mb-12 max-w-3xl mx-auto"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.4 }}
            >
              Your smart, connected metro experience for Kochi — plan, monitor and optimize with ease.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.6 }}
            >
              <a href="/dashboard" className="bg-gradient-to-r from-blue-600 to-blue-500 text-white px-8 py-4 rounded-2xl font-semibold text-lg hover:shadow-2xl hover:shadow-blue-500/25 hover:scale-105 transition-all duration-300 inline-flex items-center">
                Explore Metro
                <ArrowRight className="ml-2 h-5 w-5" />
              </a>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Admin Feature Hero Sections */}
      <section id="features" className="py-10 bg-white/60 dark:bg-slate-900/40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
          {/* Dashboard Overview Section */}
          <motion.section
            id="dashboard"
            className="relative overflow-hidden rounded-3xl border border-slate-200 dark:border-slate-700/50 bg-white/80 dark:bg-slate-800/70"
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            <div className="pointer-events-none absolute -top-16 -right-16 h-64 w-64 rounded-full blur-3xl bg-gradient-to-br from-indigo-500/20 to-blue-600/20"></div>

            <div className="relative z-10 p-10 md:p-16 grid gap-8 md:grid-cols-[1.2fr_auto] items-start">
              <div className="flex items-start gap-4">
                <div className="w-16 h-16 rounded-2xl flex items-center justify-center border border-slate-200 dark:border-slate-700/60 bg-white/80 dark:bg-slate-900/60">
                  <BarChart3 className="h-8 w-8 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <div className="inline-flex items-center gap-2 mb-2">
                    <span className="text-xs px-2 py-0.5 rounded-full bg-slate-900/60 border border-slate-700/60 text-blue-300">Overview</span>
                  </div>
                  <h3 className="text-3xl md:text-4xl font-semibold text-gray-900 dark:text-white">Dashboard</h3>
                  <p className="text-gray-700 dark:text-gray-300 mt-3 text-lg">Everything ops leaders need at a glance.</p>

                  <div className="mt-8 grid sm:grid-cols-2 gap-4">
                    {[
                      'Live KPIs: Active trains, pending cleaning, average mileage',
                      'Certificate status across RST, Signalling and Telecom',
                      'Job cards by state: Open, In Progress, Closed',
                      'Cleaning compliance and upcoming tasks',
                      'Mileage trends and equalization hints',
                      'Quick navigation to detailed modules'
                    ].map((point, i) => (
                      <div
                        key={i}
                        className="group flex items-start gap-3 rounded-2xl border border-slate-200 dark:border-slate-700/60 bg-white/70 dark:bg-slate-900/40 px-4 py-3 hover:border-blue-600/50 hover:bg-white/90 dark:hover:bg-slate-900/60 transition"
                      >
                        <div className="mt-0.5">
                          <CheckCircle2 className="h-5 w-5 text-blue-400 group-hover:text-blue-300" />
                        </div>
                        <p className="text-gray-800 dark:text-gray-200">{point}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="md:justify-self-end">
                <a href="/dashboard" className="inline-flex items-center gap-2 px-6 py-4 rounded-2xl bg-gradient-to-r from-blue-600 to-blue-500 text-white font-semibold hover:shadow-2xl hover:shadow-blue-500/20 transition text-lg">
                  Go to Dashboard
                  <ArrowRight className="h-4 w-4" />
                </a>
              </div>
            </div>
          </motion.section>

          {/* Admin Overview Section */}
          <motion.section
            id="admin"
            className="relative overflow-hidden rounded-3xl border border-slate-200 dark:border-slate-700/50 bg-white/80 dark:bg-slate-800/70"
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            <div className="pointer-events-none absolute -top-16 -right-16 h-64 w-64 rounded-full blur-3xl bg-gradient-to-br from-teal-500/20 to-emerald-600/20"></div>

            <div className="relative z-10 p-10 md:p-16 grid gap-8 md:grid-cols-[1.2fr_auto] items-start">
              <div className="flex items-start gap-4">
                <div className="w-16 h-16 rounded-2xl flex items-center justify-center border border-slate-200 dark:border-slate-700/60 bg-white/80 dark:bg-slate-900/60">
                  <Shield className="h-8 w-8 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <div className="inline-flex items-center gap-2 mb-2">
                    <span className="text-xs px-2 py-0.5 rounded-full bg-slate-900/60 border border-slate-700/60 text-blue-300">Admin</span>
                  </div>
                  <h3 className="text-3xl md:text-4xl font-semibold text-gray-900 dark:text-white">Admin Console</h3>
                  <p className="text-gray-700 dark:text-gray-300 mt-3 text-lg">Configure users, access and system behaviour.</p>

                  <div className="mt-8 grid sm:grid-cols-2 gap-4">
                    {[
                      'User & role management with granular permissions',
                      'Audit logs for critical actions and sign-ins',
                      'Data imports/validation and scheduled jobs',
                      'System settings: theming, org profile, notifications',
                      'Access policies and session controls',
                      'Integrations and API keys'
                    ].map((point, i) => (
                      <div
                        key={`admin-${i}`}
                        className="group flex items-start gap-3 rounded-2xl border border-slate-200 dark:border-slate-700/60 bg-white/70 dark:bg-slate-900/40 px-4 py-3 hover:border-blue-600/50 hover:bg-white/90 dark:hover:bg-slate-900/60 transition"
                      >
                        <div className="mt-0.5">
                          <CheckCircle2 className="h-5 w-5 text-blue-400 group-hover:text-blue-300" />
                        </div>
                        <p className="text-gray-800 dark:text-gray-200">{point}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="md:justify-self-end">
                <a href="/admin" className="inline-flex items-center gap-2 px-6 py-4 rounded-2xl bg-gradient-to-r from-blue-600 to-blue-500 text-white font-semibold hover:shadow-2xl hover:shadow-blue-500/20 transition text-lg">
                  Go to Admin
                  <ArrowRight className="h-4 w-4" />
                </a>
              </div>
            </div>
          </motion.section>
        </div>
      </section>

      {/* Contact Section removed as requested */}

      {/* Footer */}
      <footer className="bg-white text-gray-900 dark:bg-slate-900 dark:text-white py-12 border-t border-slate-200 dark:border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-1 gap-8">
            <div>
              <div className="flex items-center mb-4">
                <Train className="h-8 w-8 text-blue-400 mr-2" />
                <span className="text-xl font-bold">KochiKonnect</span>
              </div>
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                Connecting Kochi with safe, reliable, and efficient metro transportation services.
              </p>
            </div>
          </div>

          <div className="border-t border-slate-200 dark:border-slate-800 mt-8 pt-8 text-center">
            <p className="text-gray-600 dark:text-gray-400">
              © 2025 KochiKonnect. All rights reserved.
            </p>
            <p className="mt-2">
              <a
                href="https://kochimetro.org/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 dark:text-blue-400 hover:underline"
              >
                https://kochimetro.org/
              </a>
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}

export default SimpleLandingPage


