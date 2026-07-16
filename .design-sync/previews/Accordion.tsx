import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "veloria-app";

export const HallBookingFaq = () => (
  <div className="w-80">
    <Accordion type="single" collapsible defaultValue="advance">
      <AccordionItem value="advance">
        <AccordionTrigger>How much advance secures a date?</AccordionTrigger>
        <AccordionContent>
          A 25% advance on the quoted amount blocks your date. For Muhurtham
          dates, the advance must be paid within 48 hours of the quotation
          being shared.
        </AccordionContent>
      </AccordionItem>
      <AccordionItem value="halls">
        <AccordionTrigger>Which halls can host 800+ guests?</AccordionTrigger>
        <AccordionContent>
          Grand Orchid Hall seats up to 1,200 for receptions. Lotus Lawn can
          host 900 in a floating-crowd setup.
        </AccordionContent>
      </AccordionItem>
      <AccordionItem value="catering">
        <AccordionTrigger>Can we bring outside caterers?</AccordionTrigger>
        <AccordionContent>
          Yes, empanelled caterers are allowed in all venues. A kitchen usage
          fee of Rs 15,000 applies at Pearl Pavilion.
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  </div>
);

export const EventDayChecklist = () => (
  <div className="w-80">
    <Accordion type="multiple" defaultValue={["decor", "fnb"]}>
      <AccordionItem value="decor">
        <AccordionTrigger>Decor and staging</AccordionTrigger>
        <AccordionContent>
          <ul className="flex flex-col gap-1 text-muted-foreground">
            <li>Mandap floral setup signed off by 6:00 AM</li>
            <li>Stage backdrop lighting tested</li>
            <li>Entrance arch photos sent to client</li>
          </ul>
        </AccordionContent>
      </AccordionItem>
      <AccordionItem value="fnb">
        <AccordionTrigger>Kitchen and F&amp;B</AccordionTrigger>
        <AccordionContent>
          <ul className="flex flex-col gap-1 text-muted-foreground">
            <li>Breakfast counters live by 7:30 AM</li>
            <li>Welcome drink station at hall entry</li>
            <li>BEO headcount reconfirmed with caterer</li>
          </ul>
        </AccordionContent>
      </AccordionItem>
      <AccordionItem value="vendors">
        <AccordionTrigger>Vendor check-ins</AccordionTrigger>
        <AccordionContent>
          Photographer, DJ and valet team must confirm arrival on the vendor
          portal before 8:00 AM.
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  </div>
);
