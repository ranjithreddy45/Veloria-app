

const RUNO_API_BASE = "https://api.runo.in/v1";

type RunoAllocationData = {
  name: string;
  number: string;
  email?: string;
  processName?: string;
  assignTo?: string; // phone number of the agent
  notes?: string;
};

export async function createRunoAllocation(data: RunoAllocationData) {
  if (!process.env.RUNO_API_KEY) {
    throw new Error("RUNO_API_KEY is not set.");
  }

  const response = await fetch(`${RUNO_API_BASE}/crm/allocation`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Auth-Key": process.env.RUNO_API_KEY,
    },
    body: JSON.stringify(data),
  });

  const json = await response.json();
  if (!response.ok || json.statusCode !== 0) {
    console.error("Runo Allocation Error:", json);
    throw new Error(json.message || "Failed to create Runo allocation");
  }

  return json;
}

export async function fetchRunoCallLogs(dateStr: string) {
  if (!process.env.RUNO_API_KEY) {
    throw new Error("RUNO_API_KEY is not set.");
  }

  // Fetch all pages (up to 100 per page)
  let allLogs: any[] = [];
  let pageNo = 1;
  let hasMore = true;

  while (hasMore) {
    const url = new URL(`${RUNO_API_BASE}/call/logs`);
    url.searchParams.set("date", dateStr);
    url.searchParams.set("pageNo", pageNo.toString());

    const response = await fetch(url.toString(), {
      method: "GET",
      headers: {
        "Auth-Key": process.env.RUNO_API_KEY,
      },
    });

    const json = await response.json();
    if (!response.ok || json.statusCode !== 0) {
      console.error("Runo Call Logs Error:", json);
      throw new Error(json.message || "Failed to fetch Runo call logs");
    }

    const logs = json.data?.callLogs || [];
    allLogs = [...allLogs, ...logs];

    // If we received fewer than 100 logs, it's the last page.
    if (logs.length < 100) {
      hasMore = false;
    } else {
      pageNo++;
    }
  }

  return allLogs;
}
