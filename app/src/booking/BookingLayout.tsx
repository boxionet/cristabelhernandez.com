import { useEffect } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";

// The public booking shell — ports layouts/booking.html: the booking
// header (back button + horizontal logo), no footer, and the
// `booking-page` body class the booking styles scope under.
export default function BookingLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const path = location.pathname.replace(/\/$/, "") || "/reservar";

  useEffect(() => {
    document.body.classList.add("booking-page");
    return () => {
      document.body.classList.remove("booking-page");
    };
  }, []);

  // No going back from the entry or the thank-you page.
  const hideBack =
    path === "/reservar" || path === "/reservar/confirmacion";

  function goBack() {
    if (path === "/reservar/datos") navigate("/reservar/fecha-hora");
    else if (path === "/reservar/fecha-hora") navigate("/reservar/servicios");
    else if (path === "/reservar/servicios") navigate("/reservar");
    else navigate(-1);
  }

  return (
    <>
      <header id="booking-header" className="booking-header">
        <div className="booking-header-container">
          <button
            className="booking-back-btn"
            aria-label="Volver atrás"
            id="booking-back-btn"
            type="button"
            onClick={goBack}
            style={hideBack ? { visibility: "hidden" } : undefined}
          >
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M20 12H4M4 12L10.0377 18M4 12L10.0377 6"
                stroke="#1D1D1F"
                strokeWidth="1.5"
              />
            </svg>
          </button>
          <a href="/" className="booking-header-logo" aria-label="Ir al inicio">
            <img
              src="/assets/svgs/cristabel_logo_horizontal.svg"
              alt="Dra. Cristabel Hernandez"
              width="350"
              height="120"
              decoding="async"
            />
          </a>
          <div className="booking-header-spacer"></div>
        </div>
      </header>
      <main id="main" className="booking-main">
        <Outlet />
      </main>
    </>
  );
}
