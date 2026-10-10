/** Keep the formatted value intact while giving Chinese units a quieter scale. */
export function StatisticValue({ value }: { value: string }) {
  const parts = value.split(/(小时|小時|分|公里|英里)/);
  if (parts.length === 1) return <strong>{value}</strong>;
  return (
    <strong>
      {parts.map((part, index) =>
        /^(小时|小時|分|公里|英里)$/.test(part) ? (
          <span className="statistic-unit" key={index}>
            {part}
          </span>
        ) : (
          part
        ),
      )}
    </strong>
  );
}
