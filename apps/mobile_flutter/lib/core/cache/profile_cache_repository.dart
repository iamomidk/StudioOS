import 'package:isar/isar.dart';
import 'package:path_provider/path_provider.dart';

import 'profile_cache.dart';

abstract class ProfileCacheRepositoryPort {
  Future<Map<String, dynamic>?> readProfile();
  Future<void> writeProfile(Map<String, dynamic> profile);
  Future<void> clearProfile();
}

class ProfileCacheRepository implements ProfileCacheRepositoryPort {
  ProfileCacheRepository() : _isarFuture = _openIsar();

  final Future<Isar> _isarFuture;

  @override
  Future<Map<String, dynamic>?> readProfile() async {
    final isar = await _isarFuture;
    final cache = await isar.profileCaches.get(0);
    if (cache == null) {
      return null;
    }

    final roles = cache.rolesCsv.isEmpty
        ? <String>[]
        : cache.rolesCsv
              .split(',')
              .map((role) => role.trim())
              .where((role) => role.isNotEmpty)
              .toList();

    return {
      'email': cache.email,
      'firstName': cache.firstName,
      'lastName': cache.lastName,
      'roles': roles,
      'updatedAt': cache.updatedAt.toIso8601String(),
    };
  }

  @override
  Future<void> writeProfile(Map<String, dynamic> profile) async {
    final isar = await _isarFuture;
    final roles = (profile['roles'] as List<dynamic>? ?? const <dynamic>[])
        .map((role) => role.toString())
        .join(',');

    final cache = ProfileCache()
      ..id = 0
      ..email = profile['email']?.toString() ?? ''
      ..firstName = profile['firstName']?.toString() ?? ''
      ..lastName = profile['lastName']?.toString() ?? ''
      ..rolesCsv = roles
      ..updatedAt = DateTime.now().toUtc();

    await isar.writeTxn(() async {
      await isar.profileCaches.put(cache);
    });
  }

  @override
  Future<void> clearProfile() async {
    final isar = await _isarFuture;
    await isar.writeTxn(() async {
      await isar.profileCaches.delete(0);
    });
  }

  static Future<Isar> _openIsar() async {
    final directory = await getApplicationDocumentsDirectory();

    if (Isar.instanceNames.contains('studioos_cache')) {
      return Future.value(Isar.getInstance('studioos_cache'));
    }

    return Isar.open(
      [ProfileCacheSchema],
      directory: directory.path,
      name: 'studioos_cache',
    );
  }
}
