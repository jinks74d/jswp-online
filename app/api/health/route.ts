// app/api/health/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase";

interface HealthCheck {
  status: "healthy" | "degraded" | "unhealthy";
  timestamp: string;
  version: string;
  environment: string;
  checks: {
    database: HealthCheckResult;
    auth: HealthCheckResult;
    storage: HealthCheckResult;
    memory: HealthCheckResult;
  };
  uptime: number;
  responseTime: number;
}

interface HealthCheckResult {
  status: "pass" | "fail" | "warn";
  responseTime?: number;
  message?: string;
  details?: Record<string, any>;
}

const startTime = Date.now();

export async function GET(request: NextRequest) {
  const checkStartTime = Date.now();

  try {
    // Run all health checks in parallel
    const [databaseCheck, authCheck, storageCheck, memoryCheck] =
      await Promise.allSettled([
        checkDatabase(),
        checkAuth(),
        checkStorage(),
        checkMemory(),
      ]);

    const checks = {
      database: getResultFromSettled(databaseCheck),
      auth: getResultFromSettled(authCheck),
      storage: getResultFromSettled(storageCheck),
      memory: getResultFromSettled(memoryCheck),
    };

    // Determine overall status
    const overallStatus = determineOverallStatus(checks);

    const responseTime = Date.now() - checkStartTime;
    const uptime = Date.now() - startTime;

    const healthCheck: HealthCheck = {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || "1.0.0",
      environment: process.env.NODE_ENV || "development",
      checks,
      uptime,
      responseTime,
    };

    // Set appropriate HTTP status code
    const httpStatus =
      overallStatus === "healthy"
        ? 200
        : overallStatus === "degraded"
        ? 200
        : 503;

    return NextResponse.json(healthCheck, { status: httpStatus });
  } catch (error) {
    const responseTime = Date.now() - checkStartTime;

    return NextResponse.json(
      {
        status: "unhealthy",
        timestamp: new Date().toISOString(),
        version: process.env.npm_package_version || "1.0.0",
        environment: process.env.NODE_ENV || "development",
        error: error instanceof Error ? error.message : "Unknown error",
        responseTime,
        uptime: Date.now() - startTime,
      },
      { status: 503 }
    );
  }
}

function getResultFromSettled(
  settled: PromiseSettledResult<HealthCheckResult>
): HealthCheckResult {
  if (settled.status === "fulfilled") {
    return settled.value;
  } else {
    return {
      status: "fail",
      message:
        settled.reason instanceof Error
          ? settled.reason.message
          : "Unknown error",
    };
  }
}

function determineOverallStatus(
  checks: Record<string, HealthCheckResult>
): "healthy" | "degraded" | "unhealthy" {
  const results = Object.values(checks);

  if (results.every((check) => check.status === "pass")) {
    return "healthy";
  }

  if (results.some((check) => check.status === "fail")) {
    // Critical services failing
    const criticalServices = ["database", "auth"];
    const criticalFailures = Object.entries(checks).filter(
      ([service, check]) =>
        criticalServices.includes(service) && check.status === "fail"
    );

    if (criticalFailures.length > 0) {
      return "unhealthy";
    }

    return "degraded";
  }

  if (results.some((check) => check.status === "warn")) {
    return "degraded";
  }

  return "healthy";
}

async function checkDatabase(): Promise<HealthCheckResult> {
  const startTime = Date.now();

  try {
    const supabase = createClient();

    // Simple query to test database connectivity
    const { data, error } = await supabase
      .from("user_profiles")
      .select("id")
      .limit(1);

    const responseTime = Date.now() - startTime;

    if (error) {
      return {
        status: "fail",
        responseTime,
        message: `Database query failed: ${error.message}`,
        details: { error: error.code },
      };
    }

    // Check response time
    if (responseTime > 2000) {
      return {
        status: "warn",
        responseTime,
        message: "Database response time is slow",
        details: { threshold: 2000 },
      };
    }

    return {
      status: "pass",
      responseTime,
      message: "Database is responsive",
    };
  } catch (error) {
    return {
      status: "fail",
      responseTime: Date.now() - startTime,
      message:
        error instanceof Error ? error.message : "Database connection failed",
    };
  }
}

async function checkAuth(): Promise<HealthCheckResult> {
  const startTime = Date.now();

  try {
    const supabase = createClient();

    // Test auth service by getting session (should not throw)
    const { data, error } = await supabase.auth.getSession();

    const responseTime = Date.now() - startTime;

    if (error) {
      return {
        status: "fail",
        responseTime,
        message: `Auth service error: ${error.message}`,
      };
    }

    // Check response time
    if (responseTime > 1000) {
      return {
        status: "warn",
        responseTime,
        message: "Auth service response time is slow",
        details: { threshold: 1000 },
      };
    }

    return {
      status: "pass",
      responseTime,
      message: "Auth service is responsive",
    };
  } catch (error) {
    return {
      status: "fail",
      responseTime: Date.now() - startTime,
      message: error instanceof Error ? error.message : "Auth service failed",
    };
  }
}

async function checkStorage(): Promise<HealthCheckResult> {
  const startTime = Date.now();

  try {
    const supabase = createClient();

    // Test storage by listing buckets
    const { data, error } = await supabase.storage.listBuckets();

    const responseTime = Date.now() - startTime;

    if (error) {
      return {
        status: "fail",
        responseTime,
        message: `Storage service error: ${error.message}`,
      };
    }

    // Check response time
    if (responseTime > 1500) {
      return {
        status: "warn",
        responseTime,
        message: "Storage service response time is slow",
        details: { threshold: 1500 },
      };
    }

    return {
      status: "pass",
      responseTime,
      message: "Storage service is responsive",
      details: { buckets: data?.length || 0 },
    };
  } catch (error) {
    return {
      status: "fail",
      responseTime: Date.now() - startTime,
      message:
        error instanceof Error ? error.message : "Storage service failed",
    };
  }
}

async function checkMemory(): Promise<HealthCheckResult> {
  try {
    const memoryUsage = process.memoryUsage();
    const memoryUsageMB = {
      rss: Math.round(memoryUsage.rss / 1024 / 1024),
      heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024),
      heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024),
      external: Math.round(memoryUsage.external / 1024 / 1024),
    };

    // Check memory thresholds
    const heapUsagePercent =
      (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100;

    if (memoryUsageMB.heapUsed > 512) {
      // 512MB threshold
      return {
        status: "fail",
        message: "Memory usage is critically high",
        details: {
          ...memoryUsageMB,
          heapUsagePercent: Math.round(heapUsagePercent),
        },
      };
    }

    if (memoryUsageMB.heapUsed > 256 || heapUsagePercent > 80) {
      // 256MB or 80% threshold
      return {
        status: "warn",
        message: "Memory usage is elevated",
        details: {
          ...memoryUsageMB,
          heapUsagePercent: Math.round(heapUsagePercent),
        },
      };
    }

    return {
      status: "pass",
      message: "Memory usage is normal",
      details: {
        ...memoryUsageMB,
        heapUsagePercent: Math.round(heapUsagePercent),
      },
    };
  } catch (error) {
    return {
      status: "fail",
      message: error instanceof Error ? error.message : "Memory check failed",
    };
  }
}

// Detailed health check endpoint
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { includeDetails = false } = body;

    // Get basic health check
    const healthResponse = await GET(request);
    const healthData = await healthResponse.json();

    if (!includeDetails) {
      return NextResponse.json(healthData);
    }

    // Add detailed system information
    const detailedHealth = {
      ...healthData,
      system: {
        platform: process.platform,
        arch: process.arch,
        nodeVersion: process.version,
        pid: process.pid,
        uptime: process.uptime(),
        loadAverage: process.loadavg?.() || [],
        cpuUsage: process.cpuUsage(),
      },
      environment: {
        nodeEnv: process.env.NODE_ENV,
        hasSupabaseUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
        hasSupabaseKey: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      },
    };

    return NextResponse.json(detailedHealth);
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to generate detailed health check",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
