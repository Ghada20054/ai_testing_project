
"use client";

import { useState } from "react";

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

const handleSearch = () => {
  alert("BUTTON WORKS!");
};

  return (
    <main className="page">

      <div className="background-glow glow-one" />
      <div className="background-glow glow-two" />

      <section className="hero">

        <div className="robot-wrapper">
          <RobotIcon />
        </div>

        <h1>Hi, I’m ARGUS.</h1>

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
              onKeyDown={(e) => {
                if (e.key === "Enter") {
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
              >
                <SearchIcon />
              </button>
            </div>

          </div>

          {error && (
            <p className="url-error">
              {error}
            </p>
          )}

        </div>

      </section>

    </main>
  );
}
