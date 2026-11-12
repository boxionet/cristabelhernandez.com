import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAppDispatch } from "../store/hooks";
import {
  resetBooking,
  setCustomerType,
  type CustomerType,
} from "../store/slices/bookingSlice";

// Step 0 — "¿Cómo podemos ayudarte?" Entering /reservar/ always
// starts a fresh draft (the static landing cleared localStorage on
// every visit). The choice is recorded in the draft and both paths
// continue to the services step.
export default function ReservarStart() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();

  useEffect(() => {
    dispatch(resetBooking());
  }, [dispatch]);

  function choose(type: CustomerType) {
    dispatch(setCustomerType(type));
    navigate("/reservar/servicios");
  }

  const arrow = (
    <svg
      width="16"
      height="17"
      viewBox="0 0 16 17"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M2.00177 9.1675V7.83423H13.3346V9.1675H2.00177Z"
        fill="#1D1D1F"
      />
      <path
        d="M9.3349 4.50122L13.3347 8.50103L9.3349 12.5001"
        stroke="#1D1D1F"
        strokeWidth="1.33327"
      />
    </svg>
  );

  return (
    <section id="booking-flow-customer-type">
      <div className="booking-container">
        <div className="booking-content">
          <div className="booking-main">
            <h1 className="booking-title">¿Cómo podemos ayudarte?</h1>
            <div className="booking-options">
              <button
                className="booking-option"
                type="button"
                onClick={() => choose("new")}
              >
                <div className="booking-option-content">
                  <span className="booking-option-title">
                    Es mi primera visita
                  </span>
                  <span className="booking-option-subtitle">
                    Agenda tu valoración inicial
                  </span>
                </div>
                <div className="booking-option-arrow">{arrow}</div>
              </button>
              <button
                className="booking-option"
                type="button"
                onClick={() => choose("returning")}
              >
                <div className="booking-option-content">
                  <span className="booking-option-title">Ya soy paciente</span>
                  <span className="booking-option-subtitle">
                    Agenda tu próxima cita
                  </span>
                </div>
                <div className="booking-option-arrow">{arrow}</div>
              </button>
            </div>
          </div>
        </div>
        <div className="booking-image">
          <picture>
            <source
              srcSet="/assets/svgs/cristabel-hernandez-logo.svg"
              type="image/webp"
            />
            <img
              src="/assets/svgs/cristabel-hernandez-logo.svg"
              alt="Cristabel Hernandez - Aesthetic Services"
            />
          </picture>
        </div>
      </div>
    </section>
  );
}
