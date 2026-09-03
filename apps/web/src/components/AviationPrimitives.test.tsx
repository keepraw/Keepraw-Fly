import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AirportCode, AviationIcon, FlightStatusBadge } from "./AviationPrimitives";

describe("aviation visual primitives", () => {
  it("maps operational statuses to semantic tones", () => {
    const delayed = renderToStaticMarkup(
      <FlightStatusBadge status="delayed">+24m</FlightStatusBadge>,
    );
    const onTime = renderToStaticMarkup(
      <FlightStatusBadge status="onTime">On time</FlightStatusBadge>,
    );

    expect(delayed).toContain("aviation-status--critical");
    expect(delayed).toContain('data-flight-status="delayed"');
    expect(onTime).toContain("aviation-status--positive");
  });

  it("renders airport codes with an explicit size role", () => {
    const markup = renderToStaticMarkup(<AirportCode code="TAO" size="display" />);

    expect(markup).toContain("airport-code-display--display");
    expect(markup).toContain(">TAO</span>");
  });

  it("keeps decorative aviation icons out of the accessibility tree", () => {
    const markup = renderToStaticMarkup(<AviationIcon name="flight" />);

    expect(markup).toContain('aria-hidden="true"');
    expect(markup).toContain("aviation-icon");
  });
});
