import Capacitor
import Foundation
import WidgetKit

enum CalendarWidgetStore {
    static let suiteName = "group.com.flashtodo.app"
    static let key = "calendarWidgetSnapshot"
    static let fileName = "calendarWidgetSnapshot.json"

    static var fileURL: URL? {
        FileManager.default
            .containerURL(forSecurityApplicationGroupIdentifier: suiteName)?
            .appendingPathComponent(fileName)
    }

    static func save(_ data: Data) {
        if let url = fileURL {
            try? data.write(to: url, options: [.atomic])
        }
        let defaults = UserDefaults(suiteName: suiteName)
        defaults?.set(data, forKey: key)
        defaults?.synchronize()
    }

    static func reloadWidgets() {
        let reload = {
            let center = WidgetCenter.shared
            center.reloadTimelines(ofKind: "FlashTodoCalendar")
            center.reloadTimelines(ofKind: "FlashTodoGoals")
            center.reloadAllTimelines()
        }
        if Thread.isMainThread {
            reload()
        } else {
            DispatchQueue.main.async(execute: reload)
        }
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.4, execute: reload)
    }
}

@objc(WidgetBridgePlugin)
public class WidgetBridgePlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "WidgetBridgePlugin"
    public let jsName = "WidgetBridge"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "updateSnapshot", returnType: CAPPluginReturnPromise),
    ]

    @objc func updateSnapshot(_ call: CAPPluginCall) {
        let data: Data
        if let json = call.getString("json"), let encoded = json.data(using: .utf8) {
            data = encoded
        } else if let snapshot = call.getObject("snapshot") {
            do {
                data = try JSONSerialization.data(withJSONObject: snapshot, options: [])
            } catch {
                call.reject(error.localizedDescription)
                return
            }
        } else {
            call.reject("snapshot required")
            return
        }

        CalendarWidgetStore.save(data)
        CalendarWidgetStore.reloadWidgets()
        call.resolve()
    }
}
