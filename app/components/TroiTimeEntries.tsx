import { convertFloatTimeToHHMM } from "~/utils/dateTimeUtils";
import { TimeEntryForm } from "./TimeEntryForm";
import { TrackyTask } from "~/tasks/TrackyTask";
import { Fragment } from "react";
import { CalculationPosition } from "~/troi/troi.types";
import { TimeEntry } from "~/troi/troi.types";

interface Props {
  selectedDate: Date;
  calculationPositions: CalculationPosition[];
  recurringTasks: TrackyTask[];
  phaseTasks: TrackyTask[];
  entries: TimeEntry[];
  disabled: boolean;
}

export function TroiTimeEntries({
  selectedDate,
  calculationPositions,
  recurringTasks,
  phaseTasks,
  entries,
  disabled = false,
}: Props) {
  return calculationPositions.map((position) => (
    <section
      key={position.id}
      className="bg-white p-4"
      data-testid={`project-section-${position.id}`}
    >
      <div className="container mx-auto pb-2">
        {!entries.some(
          ({ calculationPosition }) => calculationPosition === position.id,
        ) ? (
          <TimeEntryForm
            date={selectedDate}
            calculationPosition={position}
            recurringTasks={recurringTasks}
            phaseTasks={phaseTasks}
            disabled={disabled}
          />
        ) : (
          entries
            .filter(
              ({ calculationPosition }) => calculationPosition === position.id,
            )
            .map((entry) => (
              <Fragment key={entry.id}>
                <div data-testid={`entryCard-${position.id}`}>
                  <div
                    data-test="entry-form"
                    className="my-2 flex justify-center"
                  >
                    <div className="block w-full">
                      <TimeEntryForm
                        date={selectedDate}
                        entryId={entry.id}
                        values={{
                          hours: convertFloatTimeToHHMM(entry.hours),
                          description: entry.description,
                        }}
                        recurringTasks={recurringTasks}
                        phaseTasks={phaseTasks}
                        calculationPosition={position}
                        disabled={disabled}
                      />
                    </div>
                  </div>
                </div>
                <br />
              </Fragment>
            ))
        )}
      </div>
    </section>
  ));
}
