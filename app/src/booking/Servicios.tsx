import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAppDispatch, useAppSelector } from "../store/hooks";
import {
  removeService,
  toggleService,
} from "../store/slices/bookingSlice";
import { useBookingCatalog } from "../lib/queries/bookingQueries";
import { FEATURED_SERVICE_SLUGS } from "./constants";
import ServiceCard from "./components/ServiceCard";
import CartSummary from "./components/CartSummary";

// Step 1 — pick services. The catalog is live from Supabase (no
// bundled fallback: the app cannot book without the server anyway).
// Tabs scroll to each section; an IntersectionObserver keeps the
// active tab in sync while scrolling (ported from the static page).
const TABS = [
  { id: "destacados", label: "Destacados", title: "Destacados" },
  { id: "facial", label: "Facial", title: "Medicina estética facial" },
  { id: "corporal", label: "Corporal", title: "Medicina estética corporal" },
] as const;

type TabId = (typeof TABS)[number]["id"];

export default function Servicios() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const selected = useAppSelector((s) => s.booking.services);
  const { data: catalog, isLoading, isError, refetch } = useBookingCatalog();
  const [activeTab, setActiveTab] = useState<TabId>("destacados");
  const programmaticScroll = useRef(false);
  const scrollEndTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Drop cart entries whose service left the catalog (deactivated
  // since the draft started) so a stale cart can't break later steps.
  useEffect(() => {
    if (!catalog) return;
    const slugs = new Set(catalog.map((s) => s.slug));
    for (const slug of Object.keys(selected)) {
      if (!slugs.has(slug)) dispatch(removeService(slug));
    }
  }, [catalog, selected, dispatch]);

  const sections = useMemo(() => {
    if (!catalog) return [];
    const bySlug = new Map(catalog.map((s) => [s.slug, s]));
    const featured = FEATURED_SERVICE_SLUGS.map((slug) => bySlug.get(slug))
      .filter((s) => s !== undefined)
      .map((s) => s!);
    return [
      { ...TABS[0], services: featured },
      {
        ...TABS[1],
        services: catalog.filter((s) => s.category === "facial"),
      },
      {
        ...TABS[2],
        services: catalog.filter((s) => s.category === "corporal"),
      },
    ];
  }, [catalog]);

  // Scroll-spy: the section crossing the top band owns the tab.
  useEffect(() => {
    if (!catalog || !("IntersectionObserver" in window)) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (programmaticScroll.current) return;
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveTab(entry.target.id as TabId);
          }
        }
      },
      { root: null, rootMargin: "-140px 0px -60% 0px", threshold: 0 },
    );
    for (const tab of TABS) {
      const el = document.getElementById(tab.id);
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, [catalog]);

  function scrollToTab(id: TabId) {
    programmaticScroll.current = true;
    if (scrollEndTimer.current) clearTimeout(scrollEndTimer.current);
    scrollEndTimer.current = setTimeout(() => {
      programmaticScroll.current = false;
    }, 600);
    setActiveTab(id);
    document.getElementById(id)?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }

  return (
    <section id="booking-flow-services">
      <div className="booking-services-container">
        <button
          className="booking-back-btn"
          onClick={() => navigate("/reservar")}
          aria-label="Volver atrás"
          type="button"
        >
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M15 18l-6-6 6-6"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>

        <div className="booking-services-content">
          <h1 className="booking-services-title">Selecciona un servicio</h1>

          <div className="booking-services-tabs" id="services-tabs">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                className={`booking-services-tab${activeTab === tab.id ? " active" : ""}`}
                type="button"
                onClick={() => scrollToTab(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {isLoading && (
            <p className="booking-cart-empty">Cargando tratamientos…</p>
          )}
          {isError && (
            <div>
              <p className="booking-cart-empty">
                No pudimos cargar los tratamientos. Por favor intenta de nuevo
                o llámanos al (829) 316-3313.
              </p>
              <button
                className="booking-cart-continue-btn"
                type="button"
                onClick={() => void refetch()}
              >
                Reintentar
              </button>
            </div>
          )}

          <div className="booking-services-categories">
            {sections.map((section) => (
              <section
                className="booking-services-category"
                id={section.id}
                key={section.id}
              >
                <h2 className="booking-services-category-title">
                  {section.title}
                </h2>
                <div className="booking-services-list">
                  {section.services.map((service) => (
                    <ServiceCard
                      key={service.slug}
                      service={service}
                      selected={Boolean(selected[service.slug])}
                      onToggle={(slug) => dispatch(toggleService(slug))}
                    />
                  ))}
                </div>
              </section>
            ))}
          </div>
        </div>

        {catalog && (
          <CartSummary
            catalog={catalog}
            onContinue={() => navigate("/reservar/fecha-hora")}
          />
        )}
      </div>
    </section>
  );
}
