import 'dart:convert';

import 'package:flutter_secure_storage/flutter_secure_storage.dart';

class OfflineAction {
  const OfflineAction({
    required this.id,
    required this.type,
    required this.rentalOrderId,
    required this.organizationId,
    required this.payload,
    required this.queuedAt,
  });

  final String id;
  final String type;
  final String rentalOrderId;
  final String organizationId;
  final Map<String, dynamic> payload;
  final DateTime queuedAt;

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'type': type,
      'rentalOrderId': rentalOrderId,
      'organizationId': organizationId,
      'payload': payload,
      'queuedAt': queuedAt.toUtc().toIso8601String(),
    };
  }

  static OfflineAction fromJson(Map<String, dynamic> json) {
    return OfflineAction(
      id: json['id']?.toString() ?? '',
      type: json['type']?.toString() ?? '',
      rentalOrderId: json['rentalOrderId']?.toString() ?? '',
      organizationId: json['organizationId']?.toString() ?? '',
      payload: (json['payload'] as Map<dynamic, dynamic>? ?? const {}).map(
        (key, value) => MapEntry(key.toString(), value),
      ),
      queuedAt:
          DateTime.tryParse(json['queuedAt']?.toString() ?? '')?.toUtc() ??
          DateTime.now().toUtc(),
    );
  }
}

abstract class OfflineActionQueueRepositoryPort {
  Future<List<OfflineAction>> readActions();
  Future<void> writeActions(List<OfflineAction> actions);
  Future<void> enqueueAction(OfflineAction action);
  Future<void> clear();
}

class OfflineActionQueueRepository implements OfflineActionQueueRepositoryPort {
  OfflineActionQueueRepository({FlutterSecureStorage? secureStorage})
    : _secureStorage = secureStorage ?? const FlutterSecureStorage();

  static const _queueKey = 'studioos.offline_actions';
  final FlutterSecureStorage _secureStorage;

  @override
  Future<List<OfflineAction>> readActions() async {
    final raw = await _secureStorage.read(key: _queueKey);
    if (raw == null || raw.trim().isEmpty) {
      return const <OfflineAction>[];
    }

    final decoded = jsonDecode(raw);
    if (decoded is! List<dynamic>) {
      return const <OfflineAction>[];
    }

    return decoded
        .whereType<Map<dynamic, dynamic>>()
        .map(
          (row) => OfflineAction.fromJson(
            row.map((key, value) => MapEntry(key.toString(), value)),
          ),
        )
        .toList();
  }

  @override
  Future<void> writeActions(List<OfflineAction> actions) {
    final serialized = jsonEncode(
      actions.map((action) => action.toJson()).toList(),
    );
    return _secureStorage.write(key: _queueKey, value: serialized);
  }

  @override
  Future<void> enqueueAction(OfflineAction action) async {
    final actions = await readActions();
    await writeActions([...actions, action]);
  }

  @override
  Future<void> clear() {
    return _secureStorage.delete(key: _queueKey);
  }
}
