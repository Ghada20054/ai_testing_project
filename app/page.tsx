
"use client";

import { useState } from "react";

interface PageSummary {
  pageNumber: number;
  name: string;
  url: string;
  elements: number;
  forms: number;
  inputs: number;
}

interface ExplorationResult {
  targetUrl: string;
  pages: PageSummary[];
  pageCount: number;
  skippedResources: string[];
  status: "completed" | "error" | "partial";
  errors: string[];
  sessionId: string;
}

function SearchIcon() {
  return (
    <svg width="21" height="21" viewBox="0 0 24 24" fill="none">
      <circle
        cx="11"
        cy="11"
        r="7"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <path
        d="M16.5 16.5L21 21"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function RobotIcon() {
  return (
    <svg
      className="robot-icon"
      width="100"
      height="100"
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M50 20V12"
        stroke="white"
        strokeWidth="5"
        strokeLinecap="round"
      />

      <circle
        cx="50"
        cy="9"
        r="5"
        stroke="white"
        strokeWidth="4"
      />

      <rect
        x="20"
        y="25"
        width="60"
        height="47"
        rx="18"
        stroke="white"
        strokeWidth="6"
      />

      <path
        d="M20 40H16C12 40 10 43 10 47V50C10 54 12 57 16 57H20"
        stroke="white"
        strokeWidth="5"
        strokeLinecap="round"
      />

      <path
        d="M80 40H84C88 40 90 43 90 47V50C90 54 88 57 84 57H80"
        stroke="white"
        strokeWidth="5"
        strokeLinecap="round"
      />

      <circle cx="39" cy="47" r="6" fill="white" />
      <circle cx="61" cy="47" r="6" fill="white" />

      <path
        d="M39 58C43 63 57 63 61 58"
        stroke="white"
        strokeWidth="4"
        strokeLinecap="round"
      />

      <path
        d="M61 72L76 82V68"
        stroke="white"
        strokeWidth="5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function Home() {
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ExplorationResult | null>(null);

  const validateUrlInput = (input: string): string | null => {
    const trimmed = input.trim();
    if (!trimmed) return "URL is required";

    let urlToTest = trimmed;
    if (!urlToTest.match(/^https?:\/\//i)) {
      urlToTest = `https://${urlToTest}`;
    }

    try {
      const parsed = new URL(urlToTest);
      if (!["http:", "https:"].includes(parsed.protocol)) {
        return "Only HTTP and HTTPS URLs are supported";
      }
      if (!parsed.hostname || parsed.hostname.length < 3) {
        return "Invalid hostname";
      }
      return null;
    } catch {
      return "Invalid URL format";
    }
  };

  const handleSearch = async () => {
    const validationError = validateUrlInput(url);
    if (validationError) {
      setError(validationError);
      return;
    }

    setError("");
    setLoading(true);
    setResult(null);

    try {
      const response = await fetch("/api/explore", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });

      const data = await response.json();

      if (!data.success) {
        setError(data.error || "Exploration failed");
        return;
      }

      setResult(data.result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to connect to server");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="page">

      <div className="background-glow glow-one" />
      <div className="background-glow glow-two" />

      <section className="hero">

        <div className="robot-wrapper">
          <RobotIcon />
        </div>

        <h1>Hi, I&apos;m ARGUS.</h1>

        <p>
          Watching Your Digital World Like We Have a Hundred Eyes.
        </p>

        <div className="url-container">

          <div className={`chat-box ${error ? "has-error" : ""}`}>

            <input
              type="text"
              value={url}
              onChange={(e) => {
                setUrl(e.target.value);

                if (error) {
                  setError("");
                }
              }}
              placeholder="Enter your URL"
              aria-label="Enter your URL"
              disabled={loading}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !loading) {
                  handleSearch();
                }
              }}
            />

            <div className="toolbar">
              <div />

              <button
                type="button"
                className="search-button"
                aria-label="Start testing"
                onClick={handleSearch}
                disabled={loading}
              >
                {loading ? (
                  <svg width="21" height="21" viewBox="0 0 24 24" fill="none" className="animate-spin">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" opacity="0.3" />
                    <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                ) : (
                  <SearchIcon />
                )}
              </button>
            </div>

          </div>

          {error && (
            <p className="url-error">
              {error}
            </p>
          )}

        </div>

        {loading && (
          <div className="exploration-status">
            <p>Exploring website... Please wait.</p>
          </div>
        )}

        {result && (
          <div className="exploration-results">
            <h2>Exploration Results</h2>

            <div className="result-overview">
              <div className="overview-item">
                <span className="overview-label">Target</span>
                <span className="overview-value">{result.targetUrl}</span>
              </div>
              <div className="overview-item">
                <span className="overview-label">Pages</span>
                <span className="overview-value overview-number">{result.pageCount}</span>
              </div>
              <div className="overview-item">
                <span className="overview-label">Status</span>
                <span className={`overview-value status-${result.status}`}>{result.status}</span>
              </div>
            </div>

            {result.skippedResources.length > 0 && (
              <div className="result-skipped">
                <p><strong>Skipped {result.skippedResources.length} non-HTML resource(s)</strong> (downloads, files, media, etc.)</p>
              </div>
            )}

            {result.errors.length > 0 && (
              <div className="result-errors">
                <p><strong>Errors:</strong></p>
                <ul>
                  {result.errors.map((err, i) => (
                    <li key={i}>{err}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="result-pages">
              <h3>Pages: {result.pageCount}</h3>
              {result.pages.map((page) => (
                <div key={page.pageNumber} className="page-card">
                  <div className="page-header">
                    <span className="page-number">{page.pageNumber}</span>
                    <span className="page-name">{page.name}</span>
                  </div>
                  <div className="page-details">
                    <div className="detail-row">
                      <span className="detail-label">URL:</span>
                      <span className="detail-value detail-url">{page.url}</span>
                    </div>
                    <div className="detail-row">
                      <span className="detail-label">Elements:</span>
                      <span className="detail-value">{page.elements}</span>
                    </div>
                    <div className="detail-row">
                      <span className="detail-label">Forms:</span>
                      <span className="detail-value">{page.forms}</span>
                    </div>
                    <div className="detail-row">
                      <span className="detail-label">Inputs:</span>
                      <span className="detail-value">{page.inputs}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

      </section>

    </main>
  );
}
