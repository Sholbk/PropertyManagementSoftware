"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

const PROPERTY_TYPES = [
  { value: "single_family", label: "Single Family" },
  { value: "multi_family", label: "Multi Family" },
  { value: "commercial", label: "Commercial" },
  { value: "mixed_use", label: "Mixed Use" },
  { value: "industrial", label: "Industrial" },
];

const TIMEZONES = [
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Anchorage",
  "Pacific/Honolulu",
];

const inputClass =
  "mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500";
const labelClass = "block text-sm font-medium text-gray-700";

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Step 1: Org
  const [orgName, setOrgName] = useState("");
  const [timezone, setTimezone] = useState("America/Chicago");

  // Step 2: Property (optional)
  const [addProperty, setAddProperty] = useState(true);
  const [propertyName, setPropertyName] = useState("");
  const [propertyType, setPropertyType] = useState("multi_family");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [zip, setZip] = useState("");

  async function handleComplete() {
    setError(null);
    setLoading(true);

    const payload: Record<string, unknown> = {
      orgName,
      timezone,
    };

    if (addProperty && propertyName && address && city && state && zip) {
      payload.property = {
        name: propertyName,
        property_type: propertyType,
        address_line1: address,
        city,
        state,
        zip,
      };
    }

    try {
      const res = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Something went wrong");
        setLoading(false);
        return;
      }

      router.push("/dashboard");
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-lg py-12">
      <div className="mb-8 text-center">
        <h1 className="text-2xl font-bold text-gray-900">Welcome to PMPP</h1>
        <p className="mt-1 text-sm text-gray-500">
          Let&apos;s set up your organization{step === 1 ? "" : " — almost done!"}
        </p>
      </div>

      {/* Progress */}
      <div className="mb-8 flex items-center justify-center gap-2">
        {[1, 2].map((s) => (
          <div
            key={s}
            className={`h-2 w-16 rounded-full ${s <= step ? "bg-blue-600" : "bg-gray-200"}`}
          />
        ))}
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        {step === 1 && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-gray-900">Organization Details</h2>

            <div>
              <label htmlFor="orgName" className={labelClass}>Company name</label>
              <input
                id="orgName"
                type="text"
                required
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
                className={inputClass}
                placeholder="Acme Property Management"
              />
            </div>

            <div>
              <label htmlFor="timezone" className={labelClass}>Timezone</label>
              <select
                id="timezone"
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                className={inputClass}
              >
                {TIMEZONES.map((tz) => (
                  <option key={tz} value={tz}>{tz.replace("_", " ").replace("America/", "").replace("Pacific/", "")}</option>
                ))}
              </select>
            </div>

            <Button
              onClick={() => {
                if (!orgName.trim()) {
                  setError("Company name is required");
                  return;
                }
                setError(null);
                setStep(2);
              }}
              className="w-full"
            >
              Continue
            </Button>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-gray-900">Add Your First Property</h2>

            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={addProperty}
                onChange={(e) => setAddProperty(e.target.checked)}
                className="rounded border-gray-300"
              />
              I want to add a property now
            </label>

            {addProperty && (
              <>
                <div>
                  <label htmlFor="propertyName" className={labelClass}>Property name</label>
                  <input
                    id="propertyName"
                    type="text"
                    value={propertyName}
                    onChange={(e) => setPropertyName(e.target.value)}
                    className={inputClass}
                    placeholder="Sunset Apartments"
                  />
                </div>

                <div>
                  <label htmlFor="propertyType" className={labelClass}>Property type</label>
                  <select
                    id="propertyType"
                    value={propertyType}
                    onChange={(e) => setPropertyType(e.target.value)}
                    className={inputClass}
                  >
                    {PROPERTY_TYPES.map((pt) => (
                      <option key={pt.value} value={pt.value}>{pt.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="address" className={labelClass}>Street address</label>
                  <input
                    id="address"
                    type="text"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    className={inputClass}
                    placeholder="123 Main St"
                  />
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label htmlFor="city" className={labelClass}>City</label>
                    <input
                      id="city"
                      type="text"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label htmlFor="state" className={labelClass}>State</label>
                    <input
                      id="state"
                      type="text"
                      maxLength={2}
                      value={state}
                      onChange={(e) => setState(e.target.value.toUpperCase())}
                      className={inputClass}
                      placeholder="TX"
                    />
                  </div>
                  <div>
                    <label htmlFor="zip" className={labelClass}>ZIP</label>
                    <input
                      id="zip"
                      type="text"
                      maxLength={10}
                      value={zip}
                      onChange={(e) => setZip(e.target.value)}
                      className={inputClass}
                      placeholder="78701"
                    />
                  </div>
                </div>
              </>
            )}

            {error && <p className="text-sm text-red-600">{error}</p>}

            <div className="flex gap-3">
              <Button variant="secondary" onClick={() => setStep(1)} className="flex-1">
                Back
              </Button>
              <Button onClick={handleComplete} loading={loading} className="flex-1">
                {addProperty ? "Create & Continue" : "Skip & Continue"}
              </Button>
            </div>
          </div>
        )}

        {error && step === 1 && <p className="mt-3 text-sm text-red-600">{error}</p>}
      </div>
    </div>
  );
}
