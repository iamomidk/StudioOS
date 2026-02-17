import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:studioos_mobile_flutter/app.dart';

void main() {
  testWidgets('renders flutter shell with splash route', (tester) async {
    await tester.pumpWidget(const ProviderScope(child: StudioOsApp()));

    expect(find.byType(CircularProgressIndicator), findsOneWidget);
  });
}
