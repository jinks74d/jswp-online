// app/not-found.tsx
"use client";

export const dynamic = "force-dynamic";

import Link from "next/link";
import { 
  Home, 
  BookOpen, 
  Users, 
  BarChart3, 
  FileText, 
  ArrowLeft, 
  Search,
  HelpCircle,
  GraduationCap
} from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-green-50 flex items-center justify-center px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl w-full text-center">
        {/* Header with Logo/Brand */}
        <div className="mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-blue-100 rounded-full mb-6">
            <GraduationCap className="w-10 h-10 text-blue-600" />
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 mb-2">
            404
          </h1>
          <h2 className="text-xl sm:text-2xl font-semibold text-gray-700 mb-4">
            Page Not Found
          </h2>
          <p className="text-gray-600 text-lg max-w-md mx-auto">
            Looks like this page took a study break! Don't worry, we'll help you get back to learning.
          </p>
        </div>

        {/* Quick Navigation Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
          <Link
            href="/dashboard"
            className="group bg-white rounded-lg border border-gray-200 p-6 hover:border-blue-300 hover:shadow-md transition-all duration-200 text-left"
          >
            <div className="flex items-center mb-3">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center mr-3 group-hover:bg-blue-200 transition-colors">
                <Home className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">Dashboard</h3>
                <p className="text-sm text-gray-600">Your main hub</p>
              </div>
            </div>
          </Link>

          <Link
            href="/dashboard/assignments"
            className="group bg-white rounded-lg border border-gray-200 p-6 hover:border-green-300 hover:shadow-md transition-all duration-200 text-left"
          >
            <div className="flex items-center mb-3">
              <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center mr-3 group-hover:bg-green-200 transition-colors">
                <FileText className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">Assignments</h3>
                <p className="text-sm text-gray-600">Manage coursework</p>
              </div>
            </div>
          </Link>

          <Link
            href="/dashboard/classes"
            className="group bg-white rounded-lg border border-gray-200 p-6 hover:border-purple-300 hover:shadow-md transition-all duration-200 text-left"
          >
            <div className="flex items-center mb-3">
              <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center mr-3 group-hover:bg-purple-200 transition-colors">
                <Users className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">Classes</h3>
                <p className="text-sm text-gray-600">Your classrooms</p>
              </div>
            </div>
          </Link>

          <Link
            href="/dashboard/analytics"
            className="group bg-white rounded-lg border border-gray-200 p-6 hover:border-orange-300 hover:shadow-md transition-all duration-200 text-left"
          >
            <div className="flex items-center mb-3">
              <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center mr-3 group-hover:bg-orange-200 transition-colors">
                <BarChart3 className="w-5 h-5 text-orange-600" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">Analytics</h3>
                <p className="text-sm text-gray-600">Track progress</p>
              </div>
            </div>
          </Link>
        </div>

        {/* Search Suggestion */}
        <div className="bg-white rounded-lg border border-gray-200 p-6 mb-8">
          <div className="flex items-center justify-center mb-4">
            <Search className="w-6 h-6 text-gray-400 mr-2" />
            <h3 className="text-lg font-semibold text-gray-900">Looking for something specific?</h3>
          </div>
          <p className="text-gray-600 mb-4">
            Try using the search function in your dashboard to find assignments, classes, or students.
          </p>
          <Link
            href="/dashboard"
            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Search className="w-4 h-4 mr-2" />
            Go to Dashboard
          </Link>
        </div>

        {/* Help Section */}
        <div className="bg-gray-50 rounded-lg border border-gray-200 p-6 mb-8">
          <div className="flex items-center justify-center mb-4">
            <HelpCircle className="w-6 h-6 text-gray-500 mr-2" />
            <h3 className="text-lg font-semibold text-gray-900">Need Help?</h3>
          </div>
          <p className="text-gray-600 mb-4">
            If you're having trouble finding what you need, here are some helpful tips:
          </p>
          <ul className="text-sm text-gray-600 space-y-2 text-left max-w-md mx-auto">
            <li className="flex items-start">
              <span className="w-2 h-2 bg-blue-500 rounded-full mt-2 mr-3 flex-shrink-0"></span>
              Check that you're logged in with the correct account
            </li>
            <li className="flex items-start">
              <span className="w-2 h-2 bg-blue-500 rounded-full mt-2 mr-3 flex-shrink-0"></span>
              Verify you have the right permissions for this section
            </li>
            <li className="flex items-start">
              <span className="w-2 h-2 bg-blue-500 rounded-full mt-2 mr-3 flex-shrink-0"></span>
              Contact your administrator if you can't access expected content
            </li>
          </ul>
        </div>

        {/* Back Button */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            onClick={() => window.history.back()}
            className="inline-flex items-center px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Go Back
          </button>
          
          <Link
            href="/dashboard"
            className="inline-flex items-center px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Home className="w-4 h-4 mr-2" />
            Return to Dashboard
          </Link>
        </div>

        {/* Footer */}
        <div className="mt-12 pt-8 border-t border-gray-200">
          <p className="text-sm text-gray-500">
            <strong>JSWP Online</strong> - Educational Platform
          </p>
          <p className="text-xs text-gray-400 mt-1">
            Empowering students, teachers, and administrators
          </p>
        </div>
      </div>
    </div>
  );
}