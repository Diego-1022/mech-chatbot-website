# Verification Checklist

Use fictional contact details. Run these checks against a local copy before proposing changes to the live Site.

- [ ] Homepage opens in English and the Chinese selector works.
- [ ] Desktop and mobile layouts display without horizontal overflow.
- [ ] Service cards show the intended fictional AUD ranges.
- [ ] Past dates and unavailable slots cannot be booked.
- [ ] A valid booking shows a confirmation and a private management link.
- [ ] The booking remains available after refreshing the management page.
- [ ] Two attempts to reserve the same slot cannot both succeed.
- [ ] A wrong management token cannot access the booking.
- [ ] Rescheduling releases the previous slot and reserves the new slot.
- [ ] Cancelling a booking releases its slot.
- [ ] An unsigned-in visitor cannot read administrator booking data.
- [ ] The configured administrator can close and reopen a slot.
- [ ] The assistant answers workshop enquiries in the selected language.
- [ ] A catalogue estimate uses the configured service range.
- [ ] Booking intent opens the form and does not silently create a booking.
- [ ] Without an AI key, the chat clearly identifies rule-based guidance.
- [ ] With a valid AI key, a basic enquiry returns an AI response.
- [ ] Type checking and the production build complete successfully.

## Earlier project validation

During development, local API and browser checks covered booking persistence, retry handling, invalid tokens, slot conflicts, concurrent booking attempts, rescheduling, cancellation, past-date validation, administrator restrictions, origin checks, language switching, mobile layout and AI-to-booking interaction. The live deployment succeeded and its audience was subsequently changed to public.

These describe earlier validation, not an automated test suite bundled with this archive. Repeat relevant checks after changing the code or environment. A clean installation on a teammate's device has not been verified as part of packaging.
