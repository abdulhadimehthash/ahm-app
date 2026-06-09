import React, { useState } from 'react';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  ActivityIndicator, FlatList, Pressable, StyleSheet, Text, TextInput, View
} from 'react-native';
import { ScreenHeader } from '../components/ScreenHeader';
import { supabase } from '../lib/supabase';
import { RootStackParamList } from '../lib/types';
import { colors } from '../theme/colors';
import { sharedStyles } from '../theme/styles';

type Result = {
  id: string;
  section: string;
  title: string;
  subtitle: string;
};

export function SearchScreen({ navigation }: NativeStackScreenProps<RootStackParamList,'Search'>) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Result[]>([]);
  const [loading, setLoading] = useState(false);

  async function search(q: string) {
    setQuery(q);
    if (q.trim().length < 2) { setResults([]); return; }
    setLoading(true);
    const term = q.trim().toLowerCase();

    const [dayPlans, projects, passwords, expenses, meetings, reminders] = await Promise.all([
      supabase.from('day_plans').select('id,title,plan_date,plan_time,details'),
      supabase.from('projects').select('id,name,domain,description'),
      supabase.from('password_entries').select('id,username,category'),
      supabase.from('expenses').select('id,name,amount,date'),
      supabase.from('meeting_notes').select('id,client_name,date,discussion'),
      supabase.from('reminders').select('id,description,remind_at'),
    ]);

    const all: Result[] = [];

    (dayPlans.data ?? []).filter(p => p.title.toLowerCase().includes(term) || (p.details && p.details.toLowerCase().includes(term))).forEach(p =>
      all.push({ id:p.id, section:'Calendar', title:p.title, subtitle:`${p.plan_date} · ${p.plan_time}` })
    );
    (projects.data ?? []).filter(p => p.name.toLowerCase().includes(term)||p.domain.toLowerCase().includes(term)||p.description.toLowerCase().includes(term)).forEach(p =>
      all.push({ id:p.id, section:'Projects', title:p.name, subtitle:p.domain })
    );
    (passwords.data ?? []).filter(pw => pw.username.toLowerCase().includes(term)).forEach(pw =>
      all.push({ id:pw.id, section:'Passwords', title:pw.username, subtitle:pw.category })
    );
    (expenses.data ?? []).filter(e => e.name.toLowerCase().includes(term)).forEach(e =>
      all.push({ id:e.id, section:'Finance', title:e.name, subtitle:`₹${e.amount} · ${e.date}` })
    );
    (meetings.data ?? []).filter(m => m.client_name.toLowerCase().includes(term)||m.discussion.toLowerCase().includes(term)).forEach(m =>
      all.push({ id:m.id, section:'Meetings', title:m.client_name, subtitle:m.date })
    );
    (reminders.data ?? []).filter(r => r.description.toLowerCase().includes(term)).forEach(r =>
      all.push({ id:r.id, section:'Reminders', title:r.description, subtitle:new Date(r.remind_at).toLocaleDateString('en-IN') })
    );

    setLoading(false);
    setResults(all);
  }

  // Group by section
  const sections: { section: string; data: Result[] }[] = [];
  const seen = new Set<string>();
  results.forEach(r => {
    if (!seen.has(r.section)) { seen.add(r.section); sections.push({ section: r.section, data: [] }); }
    sections.find(s => s.section === r.section)!.data.push(r);
  });

  return (
    <View style={sharedStyles.screen}>
      <View style={sharedStyles.contentContainer}>
        <ScreenHeader title="Search" navigation={navigation} />

        <View style={styles.searchBar}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Search everything..."
            placeholderTextColor={colors.muted}
            value={query}
            onChangeText={search}
            autoFocus
            returnKeyType="search"
          />
          {query.length > 0 && (
            <Pressable onPress={() => { setQuery(''); setResults([]); }}>
              <Text style={styles.clearBtn}>×</Text>
            </Pressable>
          )}
        </View>

        {loading && <ActivityIndicator color={colors.white} style={{ marginTop: 20 }} />}

        {!loading && query.length >= 2 && results.length === 0 && (
          <Text style={styles.noResults}>No results for "{query}"</Text>
        )}

        {!loading && query.length < 2 && query.length > 0 && (
          <Text style={styles.hint}>Keep typing to search...</Text>
        )}

        <FlatList
          data={sections}
          keyExtractor={item => item.section}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 60 }}
          renderItem={({ item: sec }) => (
            <>
              <Text style={styles.sectionLabel}>{sec.section}</Text>
              {sec.data.map(r => (
                <View key={r.id} style={styles.resultCard}>
                  <Text style={styles.resultTitle}>{r.title}</Text>
                  <Text style={styles.resultSubtitle}>{r.subtitle}</Text>
                </View>
              ))}
            </>
          )}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  searchBar: { flexDirection:'row', alignItems:'center', backgroundColor:colors.card, borderRadius:16, borderWidth:1, borderColor:colors.border, paddingHorizontal:14, marginBottom:20, height:52 },
  searchIcon: { fontSize:16, marginRight:10 },
  searchInput: { flex:1, color:colors.white, fontSize:16 },
  clearBtn: { color:colors.muted, fontSize:24, paddingHorizontal:4 },
  sectionLabel: { color:colors.muted, fontSize:11, fontWeight:'700', textTransform:'uppercase', letterSpacing:1, marginBottom:8, marginTop:16 },
  resultCard: { backgroundColor:colors.card, borderRadius:16, borderWidth:1, borderColor:colors.border, paddingVertical:12, paddingHorizontal:16, marginBottom:8 },
  resultTitle: { color:colors.white, fontSize:15, fontWeight:'700', marginBottom:3 },
  resultSubtitle: { color:colors.muted, fontSize:13 },
  noResults: { color:colors.muted, textAlign:'center', marginTop:40, fontSize:15 },
  hint: { color:colors.muted, textAlign:'center', marginTop:20, fontSize:14 }
});
