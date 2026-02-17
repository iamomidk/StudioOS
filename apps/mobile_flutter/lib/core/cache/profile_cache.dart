import 'package:isar/isar.dart';

part 'profile_cache.g.dart';

@collection
class ProfileCache {
  Id id = 0;

  late String email;
  late String firstName;
  late String lastName;
  late String rolesCsv;
  late DateTime updatedAt;
}
