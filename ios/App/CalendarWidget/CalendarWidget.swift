import AppIntents
import SwiftUI
import WidgetKit

enum GoalPeriod: String, AppEnum {
    case day
    case week
    case month
    case year

    static var typeDisplayRepresentation: TypeDisplayRepresentation = "Период"
    static var caseDisplayRepresentations: [GoalPeriod: DisplayRepresentation] = [
        .day: "День",
        .week: "Неделя",
        .month: "Месяц",
        .year: "Год",
    ]
}

struct SelectGoalPeriodIntent: WidgetConfigurationIntent {
    static var title: LocalizedStringResource = "Цели"
    static var description: IntentDescription = IntentDescription("День, неделя, месяц или год")
    static var isDiscoverable: Bool { false }

    @Parameter(title: "Период", default: .day)
    var period: GoalPeriod
}

struct TodayGoal: Identifiable {
    let id: String
    let text: String
    let completed: Bool
    let date: String
}

struct HabitTemplate {
    let id: String
    let text: String
    let startDate: String
    let completions: [String: Bool]
    let skipped: Set<String>
}

struct CalendarSnapshot {
    var writtenFor: String
    var streak: Int
    var statuses: [String: String]
    var goals: [TodayGoal]
    var goalsByPeriod: [String: [TodayGoal]]
    var habits: [HabitTemplate]
    var completedDays: Set<String>
    var freezeDates: Set<String>
    var counts: [String: Int]
    var updatedAt: Double

    static let empty = CalendarSnapshot(
        writtenFor: "",
        streak: 0,
        statuses: [:],
        goals: [],
        goalsByPeriod: [:],
        habits: [],
        completedDays: [],
        freezeDates: [],
        counts: [:],
        updatedAt: 0
    )

    static func dateKey(_ date: Date) -> String {
        let c = Calendar.current.dateComponents([.year, .month, .day], from: date)
        return String(format: "%04d-%02d-%02d", c.year ?? 0, c.month ?? 0, c.day ?? 0)
    }

    static func addDays(_ key: String, _ delta: Int) -> String {
        let formatter = DateFormatter()
        formatter.calendar = Calendar.current
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = TimeZone.current
        formatter.dateFormat = "yyyy-MM-dd"
        guard let date = formatter.date(from: key),
              let shifted = Calendar.current.date(byAdding: .day, value: delta, to: date)
        else { return key }
        return formatter.string(from: shifted)
    }

    static func loadData() -> Data? {
        let suite = "group.com.flashtodo.app"
        if let url = FileManager.default
            .containerURL(forSecurityApplicationGroupIdentifier: suite)?
            .appendingPathComponent("calendarWidgetSnapshot.json"),
           let data = try? Data(contentsOf: url),
           !data.isEmpty
        {
            return data
        }
        return UserDefaults(suiteName: suite)?.data(forKey: "calendarWidgetSnapshot")
    }

    static func load() -> CalendarSnapshot {
        guard
            let data = loadData(),
            let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any]
        else { return .empty }

        let streak = json["streak"] as? Int ?? Int(json["streak"] as? Double ?? 0)
        let writtenFor = json["today"] as? String ?? ""
        let raw = json["statuses"] as? [String: String] ?? [:]
        let goals = parseGoals(json["goals"] as? [[String: Any]] ?? [], defaultDate: writtenFor)
        var goalsByPeriod: [String: [TodayGoal]] = [:]
        if let nested = json["goalsByPeriod"] as? [String: Any] {
            for (key, value) in nested {
                if let items = value as? [[String: Any]] {
                    goalsByPeriod[key] = parseGoals(items, defaultDate: writtenFor)
                }
            }
        }
        if goalsByPeriod["day"] == nil {
            goalsByPeriod["day"] = goals
        }
        let habits = (json["habits"] as? [[String: Any]] ?? []).compactMap { item -> HabitTemplate? in
            let text = (item["text"] as? String)?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
            guard let id = item["id"] as? String, !text.isEmpty else { return nil }
            let completionsRaw = item["completions"] as? [String: Any] ?? [:]
            let skippedRaw = item["skippedDates"] as? [String: Any] ?? [:]
            return HabitTemplate(
                id: id,
                text: text,
                startDate: item["startDate"] as? String ?? "",
                completions: completionsRaw.mapValues { ($0 as? Bool) ?? false },
                skipped: Set(skippedRaw.keys)
            )
        }
        let completed = json["completedDays"] as? [String] ?? []
        let freezes = json["freezeDates"] as? [String] ?? []
        let countsRaw = json["counts"] as? [String: Any] ?? [:]
        let counts = countsRaw.reduce(into: [String: Int]()) { result, item in
            let value = (item.value as? Int) ?? Int(item.value as? Double ?? 0)
            if value > 0 { result[item.key] = value }
        }

        return CalendarSnapshot(
            writtenFor: writtenFor,
            streak: max(0, streak),
            statuses: raw,
            goals: goals,
            goalsByPeriod: goalsByPeriod,
            habits: habits,
            completedDays: Set(completed),
            freezeDates: Set(freezes),
            counts: counts,
            updatedAt: json["updatedAt"] as? Double ?? Date().timeIntervalSince1970
        )
    }

    static func parseGoals(_ items: [[String: Any]], defaultDate: String) -> [TodayGoal] {
        items.compactMap { item in
            let text = (item["text"] as? String)?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
            guard !text.isEmpty else { return nil }
            return TodayGoal(
                id: item["id"] as? String ?? text,
                text: text,
                completed: item["completed"] as? Bool ?? false,
                date: item["date"] as? String ?? defaultDate
            )
        }
    }

    static func weekStart(_ key: String) -> String {
        guard key.count >= 10 else { return key }
        let formatter = DateFormatter()
        formatter.calendar = Calendar.current
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = TimeZone.current
        formatter.dateFormat = "yyyy-MM-dd"
        let trimmed = String(key.prefix(10))
        guard let date = formatter.date(from: trimmed) else { return trimmed }
        let weekday = Calendar.current.component(.weekday, from: date)
        let mondayOffset = (weekday + 5) % 7
        return addDays(trimmed, -mondayOffset)
    }

    func listedGoals(period: GoalPeriod, at date: Date) -> [TodayGoal] {
        let today = Self.dateKey(date)
        switch period {
        case .day:
            return resolved(at: date).goals
        case .week:
            guard !writtenFor.isEmpty, Self.weekStart(writtenFor) == Self.weekStart(today) else { return [] }
            return Array((goalsByPeriod["week"] ?? []).prefix(8))
        case .month:
            guard writtenFor.prefix(7) == today.prefix(7) else { return [] }
            return Array((goalsByPeriod["month"] ?? []).prefix(8))
        case .year:
            guard writtenFor.prefix(4) == today.prefix(4) else { return [] }
            return Array((goalsByPeriod["year"] ?? []).prefix(8))
        }
    }

    /// Считает стрик и цели относительно живой даты, а не момента записи снимка.
    func resolved(at date: Date) -> (streak: Int, statuses: [String: String], goals: [TodayGoal], freezesLeft: Int, counts: [String: Int]) {
        let today = Self.dateKey(date)
        let streak = liveStreak(today: today)
        let datedGoals = goals.filter { $0.date == today }
        let habitGoals: [TodayGoal] = habits.compactMap { habit in
            if !habit.startDate.isEmpty, today < habit.startDate { return nil }
            if habit.skipped.contains(today) { return nil }
            return TodayGoal(
                id: habit.id,
                text: habit.text,
                completed: habit.completions[today] == true,
                date: today
            )
        }
        let todayGoals = datedGoals.isEmpty ? habitGoals : datedGoals

        var statuses = self.statuses
        for (key, value) in self.statuses {
            if key < today, value == "pending" || value == "partial" {
                statuses[key] = "missed"
            }
        }
        statuses.removeValue(forKey: today)
        if !todayGoals.isEmpty {
            statuses[today] = todayGoals.allSatisfy(\.completed) ? "complete" : "partial"
        } else if writtenFor == today, self.statuses[today] == "complete" {
            statuses[today] = "complete"
        } else if writtenFor == today,
                  self.statuses[today] == "pending" || self.statuses[today] == "partial"
        {
            statuses[today] = "partial"
        }

        let monthPrefix = String(today.prefix(7))
        let usedFreezes = freezeDates.filter { $0.hasPrefix(monthPrefix) }.count
        let freezesLeft = max(0, 2 - usedFreezes)

        var counts = self.counts
        let habitCount = habits.filter {
            ($0.startDate.isEmpty || today >= $0.startDate) && !$0.skipped.contains(today)
        }.count
        if counts[today] == nil, habitCount > 0 {
            counts[today] = habitCount
        }

        return (streak, statuses, todayGoals, freezesLeft, counts)
    }

    private func liveStreak(today: String) -> Int {
        if completedDays.isEmpty && freezeDates.isEmpty {
            return writtenFor == today ? streak : 0
        }
        let set = completedDays.union(freezeDates)
        var cursor = today
        if !set.contains(cursor) {
            cursor = Self.addDays(today, -1)
            if !set.contains(cursor) { return 0 }
        }
        var count = 0
        while set.contains(cursor) {
            count += 1
            cursor = Self.addDays(cursor, -1)
        }
        return count
    }
}

struct CalendarEntry: TimelineEntry {
    let date: Date
    let snapshot: CalendarSnapshot
    var period: GoalPeriod = .day
    var showSplash: Bool = false
}

struct GoalsProvider: AppIntentTimelineProvider {
    func placeholder(in context: Context) -> CalendarEntry {
        CalendarEntry(date: Date(), snapshot: .empty, period: .day, showSplash: true)
    }

    func snapshot(for configuration: SelectGoalPeriodIntent, in context: Context) async -> CalendarEntry {
        makeEntry(configuration.period)
    }

    func timeline(for configuration: SelectGoalPeriodIntent, in context: Context) async -> Timeline<CalendarEntry> {
        let entry = makeEntry(configuration.period)
        let nextMidnight = Calendar.current.nextDate(
            after: Date(),
            matching: DateComponents(hour: 0, minute: 0, second: 1),
            matchingPolicy: .nextTime
        ) ?? Date().addingTimeInterval(60 * 60 * 24)
        return Timeline(
            entries: [
                entry,
                CalendarEntry(date: nextMidnight, snapshot: entry.snapshot, period: configuration.period),
            ],
            policy: .after(nextMidnight)
        )
    }

    private func makeEntry(_ period: GoalPeriod) -> CalendarEntry {
        let snap = CalendarSnapshot.load()
        let stamp: Date
        if snap.updatedAt > 1_000_000_000_000 {
            stamp = Date(timeIntervalSince1970: snap.updatedAt / 1000)
        } else {
            stamp = Date()
        }
        return CalendarEntry(date: stamp, snapshot: snap, period: period)
    }
}

struct WidgetMetaBadges: View {
    var streak: Int
    var freezesLeft: Int
    var compact: Bool

    var body: some View {
        HStack(spacing: compact ? 5 : 7) {
            HStack(spacing: compact ? 2 : 3) {
                Image(systemName: "snowflake")
                    .font(.system(size: compact ? 10 : 12, weight: .semibold))
                    .foregroundStyle(Color(red: 0.45, green: 0.72, blue: 0.90))
                Text("\(freezesLeft)")
                    .font(.system(size: compact ? 12 : 15, weight: .semibold).monospacedDigit())
                    .foregroundStyle(Color(red: 0.45, green: 0.72, blue: 0.90))
                    .lineLimit(1)
            }
            .accessibilityLabel("Заморозки \(freezesLeft)")

            HStack(spacing: compact ? 2 : 3) {
                Image(systemName: "flame.fill")
                    .font(.system(size: compact ? 11 : 13, weight: .semibold))
                    .foregroundStyle(
                        streak > 0
                            ? Color(red: 0.96, green: 0.62, blue: 0.24)
                            : Color.secondary.opacity(0.55)
                    )
                Text("\(streak)")
                    .font(.system(size: compact ? 12 : 15, weight: .semibold).monospacedDigit())
                    .foregroundStyle(streak > 0 ? Color.primary : Color.secondary)
                    .lineLimit(1)
            }
            .accessibilityLabel("Стрик \(streak)")
        }
    }
}

struct TodayGoalsView: View {
    var entry: CalendarEntry
    @Environment(\.redactionReasons) private var redaction
    @Environment(\.widgetFamily) private var family

    private var isSmall: Bool { family == .systemSmall }
    private var isLarge: Bool { family == .systemLarge }
    private var goalLimit: Int { isLarge ? 8 : 3 }

    private var showsSplash: Bool {
        entry.showSplash || redaction.contains(.placeholder)
    }

    private var live: (streak: Int, statuses: [String: String], goals: [TodayGoal], freezesLeft: Int, counts: [String: Int]) {
        entry.snapshot.resolved(at: Date())
    }

    private var isRussian: Bool {
        Locale.current.language.languageCode?.identifier == "ru"
    }

    private var title: String {
        let now = Date()
        switch entry.period {
        case .day:
            let formatter = DateFormatter()
            formatter.locale = .current
            formatter.setLocalizedDateFormatFromTemplate("d MMMM")
            let dayMonth = formatter.string(from: now)
            return isRussian ? "Сегодня \(dayMonth)" : "Today \(dayMonth)"
        case .week:
            return isRussian ? "Неделя" : "This week"
        case .month:
            let formatter = DateFormatter()
            formatter.locale = .current
            formatter.setLocalizedDateFormatFromTemplate("LLLL")
            let month = formatter.string(from: now)
            return month.prefix(1).uppercased() + month.dropFirst()
        case .year:
            return String(Calendar.current.component(.year, from: now))
        }
    }

    private var emptyText: String {
        switch entry.period {
        case .day:
            return isRussian ? "Нет целей на сегодня" : "No goals for today"
        case .week:
            return isRussian ? "Нет целей на неделю" : "No goals this week"
        case .month:
            return isRussian ? "Нет целей на месяц" : "No goals this month"
        case .year:
            return isRussian ? "Нет целей на год" : "No goals this year"
        }
    }

    var body: some View {
        let goals = Array(entry.snapshot.listedGoals(period: entry.period, at: Date()).prefix(goalLimit))
        return ZStack {
            WidgetOpaqueFill(useSplash: showsSplash)
            if showsSplash {
                Text("Flash Todo")
                    .font(.system(size: isSmall ? 16 : 22, weight: .semibold, design: .rounded))
                    .foregroundStyle(.white)
                    .shadow(color: .black.opacity(0.35), radius: 8, y: 2)
            } else {
                VStack(alignment: .leading, spacing: isSmall ? 6 : 10) {
                    HStack(alignment: .center, spacing: 8) {
                        Text(title)
                            .font(.system(size: isSmall ? 13 : 17, weight: .semibold))
                            .foregroundStyle(.primary)
                            .lineLimit(1)
                            .minimumScaleFactor(0.75)

                        Spacer(minLength: 4)

                        WidgetMetaBadges(streak: live.streak, freezesLeft: live.freezesLeft, compact: isSmall)
                    }

                    if goals.isEmpty {
                        Text(emptyText)
                            .font(.system(size: isSmall ? 12 : 15))
                            .foregroundStyle(.secondary)
                            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
                    } else {
                        VStack(alignment: .leading, spacing: isSmall ? 5 : 8) {
                            ForEach(goals) { goal in
                                HStack(alignment: .center, spacing: 10) {
                                    ZStack {
                                        Circle()
                                            .strokeBorder(
                                                goal.completed ? Color.clear : Color.secondary.opacity(0.45),
                                                lineWidth: 1.6
                                            )
                                            .background(
                                                Circle().fill(
                                                    goal.completed
                                                        ? Color(red: 0.22, green: 0.68, blue: 0.48)
                                                        : Color.clear
                                                )
                                            )
                                        if goal.completed {
                                            Image(systemName: "checkmark")
                                                .font(.system(size: 9, weight: .bold))
                                                .foregroundStyle(.white)
                                        }
                                    }
                                    .frame(width: isSmall ? 14 : 18, height: isSmall ? 14 : 18)

                                    Text(goal.text)
                                        .font(.system(size: isSmall ? 12 : 15, weight: .medium))
                                        .foregroundStyle(goal.completed ? Color.secondary : Color.primary)
                                        .strikethrough(goal.completed, color: Color.secondary.opacity(0.7))
                                        .lineLimit(1)
                                }
                            }
                            Spacer(minLength: 0)
                        }
                    }
                }
                .padding(isSmall ? 12 : 16)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .widgetChrome(useSplash: showsSplash)
        .contentTransition(.identity)
        .transaction { $0.animation = nil }
    }
}

struct CalendarWidgetView: View {
    var entry: CalendarEntry
    @Environment(\.widgetFamily) private var family
    @Environment(\.colorScheme) private var colorScheme

    private var now: Date { Date() }
    private var live: (streak: Int, statuses: [String: String], goals: [TodayGoal], freezesLeft: Int, counts: [String: Int]) {
        entry.snapshot.resolved(at: now)
    }
    private var isLarge: Bool { family == .systemLarge }
    private var cells: [Date?] { Self.monthGrid(for: now) }
    private var rowCount: Int { max(cells.count / 7, 1) }
    private var weekdays: [String] { Self.mondayFirstWeekdays() }

    var body: some View {
        calendarBody
            .contentTransition(.identity)
            .transaction { $0.animation = nil }
    }

    private var calendarBody: some View {
        GeometryReader { geo in
            let titleH: CGFloat = isLarge ? 28 : 20
            let weekdayH: CGFloat = isLarge ? 18 : 14
            let gap: CGFloat = isLarge ? 8 : 4
            let gridH = max(geo.size.height - titleH - weekdayH - gap, 1)
            let cellH = gridH / CGFloat(rowCount)
            let cellW = geo.size.width / 7
            let circle = min(cellW, cellH) * (isLarge ? 0.72 : 0.78)
            let dayFont = min(cellW, cellH) * (isLarge ? 0.36 : 0.42)

            VStack(alignment: .leading, spacing: gap) {
                HStack(alignment: .center, spacing: 8) {
                    Text(Self.monthTitle(now, short: !isLarge))
                        .font(.system(size: isLarge ? 22 : 15, weight: .semibold))
                        .foregroundStyle(.primary)
                        .lineLimit(1)
                        .minimumScaleFactor(0.8)

                    Spacer(minLength: 4)

                    WidgetMetaBadges(
                        streak: live.streak,
                        freezesLeft: live.freezesLeft,
                        compact: !isLarge
                    )
                }
                .frame(height: titleH)

                HStack(spacing: 0) {
                    ForEach(0..<7, id: \.self) { index in
                        Text(weekdays[index])
                            .font(.system(size: isLarge ? 12 : 9, weight: .medium))
                            .foregroundStyle(.secondary)
                            .frame(maxWidth: .infinity)
                            .lineLimit(1)
                    }
                }
                .frame(height: weekdayH)

                VStack(spacing: 0) {
                    ForEach(0..<rowCount, id: \.self) { row in
                        HStack(spacing: 0) {
                            ForEach(0..<7, id: \.self) { col in
                                dayCell(
                                    cells[row * 7 + col],
                                    circle: circle,
                                    fontSize: max(dayFont, isLarge ? 15 : 10)
                                )
                                .frame(width: cellW, height: cellH)
                            }
                        }
                    }
                }
            }
        }
        .padding(isLarge ? 18 : 12)
        .widgetChrome()
    }

    @ViewBuilder
    private func dayCell(_ date: Date?, circle: CGFloat, fontSize: CGFloat) -> some View {
        let today = date.map { Calendar.current.isDate($0, inSameDayAs: now) } ?? false
        let key = date.map(Self.dateKey)
        let status = key.flatMap { live.statuses[$0] }
        let fill = fillColor(status: status, isToday: today)
        let count = key.flatMap { live.counts[$0] } ?? 0

        ZStack {
            if isLarge {
                if let fill {
                    RoundedRectangle(cornerRadius: 8, style: .continuous)
                        .fill(fill)
                } else if today {
                    RoundedRectangle(cornerRadius: 8, style: .continuous)
                        .strokeBorder(Color("AccentColor"), lineWidth: 1.5)
                } else if date != nil {
                    RoundedRectangle(cornerRadius: 8, style: .continuous)
                        .fill(colorScheme == .dark ? Color.white.opacity(0.06) : Color.black.opacity(0.05))
                }
            } else if let fill {
                Circle()
                    .fill(fill)
                    .frame(width: circle, height: circle)
            } else if today {
                Circle()
                    .strokeBorder(Color("AccentColor"), lineWidth: 1.5)
                    .frame(width: circle, height: circle)
            }

            if let date {
                Text("\(Calendar.current.component(.day, from: date))")
                    .font(.system(size: fontSize, weight: today || fill != nil ? .semibold : .regular))
                    .foregroundStyle(fill != nil ? Color.white : Color.primary)
                    .monospacedDigit()
                    .lineLimit(1)
                    .minimumScaleFactor(0.7)
            }

            if isLarge, count > 0 {
                Text("\(count)")
                    .font(.system(size: 9, weight: .semibold).monospacedDigit())
                    .foregroundStyle(fill != nil ? Color.white.opacity(0.92) : Color.secondary)
                    .lineLimit(1)
                    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topTrailing)
                    .padding(.top, 3)
                    .padding(.trailing, 4)
            }
        }
        .padding(isLarge ? 2 : 0)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    private func fillColor(status: String?, isToday: Bool) -> Color? {
        switch status {
        case "complete":
            return Color(red: 0.22, green: 0.68, blue: 0.48)
        case "missed":
            return Color(red: 0.78, green: 0.42, blue: 0.48)
        case "partial":
            return Color(red: 0.82, green: 0.62, blue: 0.28)
        case "frozen":
            return Color(red: 0.42, green: 0.62, blue: 0.78)
        case "pending":
            return isToday
                ? nil
                : (colorScheme == .dark
                    ? Color.white.opacity(0.22)
                    : Color.black.opacity(0.18))
        default:
            return nil
        }
    }

    static func monthGrid(for date: Date) -> [Date?] {
        let cal = Calendar.current
        let comps = cal.dateComponents([.year, .month], from: date)
        guard let first = cal.date(from: DateComponents(year: comps.year, month: comps.month, day: 1)),
              let dayCount = cal.range(of: .day, in: .month, for: first)?.count
        else { return [] }

        let sundayBased = cal.component(.weekday, from: first)
        let mondayOffset = (sundayBased + 5) % 7
        var cells: [Date?] = Array(repeating: nil, count: mondayOffset)

        for day in 1...dayCount {
            cells.append(
                cal.date(from: DateComponents(year: comps.year, month: comps.month, day: day))
            )
        }
        while cells.count % 7 != 0 {
            cells.append(nil)
        }
        return cells
    }

    static func mondayFirstWeekdays() -> [String] {
        let symbols = Calendar.current.veryShortStandaloneWeekdaySymbols
        guard symbols.count == 7 else {
            return ["M", "T", "W", "T", "F", "S", "S"]
        }
        let mondayFirst = Array(symbols[1...]) + [symbols[0]]
        return mondayFirst.map { String($0.prefix(1)).uppercased() }
    }

    static func monthTitle(_ date: Date, short: Bool) -> String {
        let formatter = DateFormatter()
        formatter.locale = .current
        formatter.setLocalizedDateFormatFromTemplate(short ? "MMM yyyy" : "MMMM yyyy")
        let raw = formatter.string(from: date)
        guard let first = raw.first else { return raw }
        return first.uppercased() + raw.dropFirst()
    }

    static func dateKey(_ date: Date) -> String {
        let c = Calendar.current.dateComponents([.year, .month, .day], from: date)
        return String(format: "%04d-%02d-%02d", c.year ?? 0, c.month ?? 0, c.day ?? 0)
    }
}

struct WidgetOpaqueFill: View {
    var useSplash: Bool

    var body: some View {
        ZStack {
            Color(red: 0.10, green: 0.22, blue: 0.28)
            Color("WidgetBackground").opacity(useSplash ? 0 : 1)
            if useSplash {
                Image("Splash")
                    .resizable()
                    .scaledToFill()
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .clipped()
    }
}

private extension View {
    @ViewBuilder
    func widgetChrome(useSplash: Bool = false) -> some View {
        if #available(iOSApplicationExtension 17.0, *) {
            containerBackground(for: .widget) {
                WidgetOpaqueFill(useSplash: useSplash)
            }
        } else {
            background(WidgetOpaqueFill(useSplash: useSplash))
        }
    }
}

struct FlashTodoWidgetView: View {
    var entry: CalendarEntry
    @Environment(\.widgetFamily) private var family

    var body: some View {
        Group {
            if entry.showSplash || family == .systemMedium || entry.period != .day {
                TodayGoalsView(entry: entry)
            } else {
                CalendarWidgetView(entry: entry)
            }
        }
        .id("\(entry.period.rawValue)-\(entry.snapshot.updatedAt)-\(family)")
    }
}

struct FlashTodoCalendarWidget: Widget {
    let kind = "FlashTodoCalendar"

    var body: some WidgetConfiguration {
        AppIntentConfiguration(kind: kind, intent: SelectGoalPeriodIntent.self, provider: GoalsProvider()) { entry in
            FlashTodoWidgetView(entry: entry)
                .widgetURL(URL(string: "flashtodo://calendar"))
        }
        .configurationDisplayName("Календарь")
        .description("Календарь и цели. Зажмите, чтобы выбрать день, неделю, месяц или год.")
        .supportedFamilies([.systemSmall, .systemMedium, .systemLarge])
        .contentMarginsDisabled()
    }
}

struct FlashTodoGoalsWidget: Widget {
    let kind = "FlashTodoGoals"

    var body: some WidgetConfiguration {
        AppIntentConfiguration(kind: kind, intent: SelectGoalPeriodIntent.self, provider: GoalsProvider()) { entry in
            FlashTodoWidgetView(entry: entry)
                .widgetURL(URL(string: "flashtodo://calendar"))
        }
        .configurationDisplayName("Цели")
        .description("Цели на день, неделю, месяц или год. Зажмите, чтобы выбрать период.")
        .supportedFamilies([.systemSmall, .systemMedium, .systemLarge])
        .contentMarginsDisabled()
    }
}

@main
struct FlashTodoWidgets: WidgetBundle {
    var body: some Widget {
        FlashTodoCalendarWidget()
        FlashTodoGoalsWidget()
    }
}

struct CalendarWidget_Previews: PreviewProvider {
    static var previews: some View {
        CalendarWidgetView(
            entry: CalendarEntry(
                date: Date(),
                snapshot: CalendarSnapshot(
                    writtenFor: "2026-10-11",
                    streak: 4,
                    statuses: [
                        "2026-10-08": "complete",
                        "2026-10-09": "missed",
                        "2026-10-10": "pending",
                    ],
                    goals: [
                        TodayGoal(id: "1", text: "Сделать отчёт", completed: false, date: "2026-10-11"),
                        TodayGoal(id: "2", text: "Позвонить", completed: true, date: "2026-10-11"),
                    ],
                    goalsByPeriod: [:],
                    habits: [],
                    completedDays: ["2026-10-08", "2026-10-09"],
                    freezeDates: [],
                    counts: ["2026-10-11": 3],
                    updatedAt: 0
                )
            )
        )
        .previewContext(WidgetPreviewContext(family: .systemSmall))
    }
}
