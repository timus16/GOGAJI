import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/job/$id")({
  server: {
    handlers: {
      GET: async ({ request, params, env }) => {
        try {
          const jobId = params.id;
          if (!jobId) {
            return new Response(JSON.stringify({ error: "Missing job ID" }), { status: 400 });
          }
          
          // Get DO stub
          const doId = env.JOBS_DO.idFromName("jobs");
          const stub = env.JOBS_DO.get(doId);
          
          // Get job status
          const job = await stub.getJob(jobId);
          
          if (!job) {
            return new Response(JSON.stringify({ error: "Job not found" }), { status: 404 });
          }
          
          return new Response(JSON.stringify({
            jobId: job.id,
            status: job.status,
            result: job.result,
            error: job.error,
            createdAt: job.createdAt,
            updatedAt: job.updatedAt,
          }), { headers: { "Content-Type": "application/json" } });
          
        } catch (err) {
          console.error("Job status error:", err);
          return new Response(JSON.stringify({ error: "Status check failed" }), { status: 500 });
        }
      },
    },
  },
});

