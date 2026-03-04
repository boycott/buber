import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { getBlogComments, toggleCommentApproval, deleteComment } from '../../lib/api/supabase-api';

const PER_PAGE = 20;

interface BlogComment {
  readonly id: string;
  readonly post_slug: string;
  readonly author_name: string;
  readonly content: string;
  readonly is_approved: boolean;
  readonly created_at: string;
}

export default function CommentsScreen() {
  const [comments, setComments] = useState<readonly BlogComment[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  const fetchComments = useCallback(async (page: number) => {
    setLoading(true);
    const result = await getBlogComments(page, PER_PAGE);

    result.match({
      Success: (data) => {
        setComments(data.comments as BlogComment[]);
        setTotalPages(data.totalPages);
        setTotalCount(data.totalCount);
        setCurrentPage(page);
        setLoading(false);
      },
      Failure: (err: string) => {
        console.error('Failed to fetch comments:', err);
        Alert.alert('Error', 'Failed to load comments');
        setLoading(false);
      },
    });
  }, []);

  useEffect(() => {
    fetchComments(1);
  }, [fetchComments]);

  const handleToggle = async (comment: BlogComment) => {
    setSubmitting(comment.id);
    const result = await toggleCommentApproval(comment.id, comment.is_approved);

    result.match({
      Success: () => {
        setComments((prev) =>
          prev.map((c) =>
            c.id === comment.id ? { ...c, is_approved: !c.is_approved } : c,
          ),
        );
        setSubmitting(null);
      },
      Failure: (err: string) => {
        Alert.alert('Error', `Failed to update comment: ${err}`);
        setSubmitting(null);
      },
    });
  };

  const handleDelete = async (commentId: string) => {
    Alert.alert('Delete Comment', 'Are you sure you want to delete this comment?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setSubmitting(commentId);
          const result = await deleteComment(commentId);

          result.match({
            Success: () => {
              setComments((prev) => prev.filter((c) => c.id !== commentId));
              setSubmitting(null);
            },
            Failure: (err: string) => {
              Alert.alert('Error', `Failed to delete comment: ${err}`);
              setSubmitting(null);
            },
          });
        },
      },
    ]);
  };

  const formatDate = (dateStr: string): string => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-GB', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatTime = (dateStr: string): string => {
    const d = new Date(dateStr);
    return d.toLocaleTimeString('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const renderComment = ({ item }: { item: BlogComment }) => {
    const isSubmitting = submitting === item.id;

    return (
      <View style={styles.commentCard}>
        <View style={styles.commentHeader}>
          <Text style={styles.authorName}>{item.author_name}</Text>
          <View
            style={[
              styles.statusBadge,
              item.is_approved ? styles.approvedBadge : styles.pendingBadge,
            ]}
          >
            <Text
              style={[
                styles.statusText,
                item.is_approved ? styles.approvedText : styles.pendingText,
              ]}
            >
              {item.is_approved ? 'Approved' : 'Pending'}
            </Text>
          </View>
        </View>

        <View style={styles.slugRow}>
          <Text style={styles.slugLabel}>Post:</Text>
          <Text style={styles.slugValue}>{item.post_slug}</Text>
        </View>

        <Text style={styles.contentText} numberOfLines={3}>
          {item.content}
        </Text>

        <View style={styles.dateRow}>
          <Text style={styles.dateText}>
            {formatDate(item.created_at)} · {formatTime(item.created_at)}
          </Text>
        </View>

        <View style={styles.actionsRow}>
          <TouchableOpacity
            style={[
              styles.actionButton,
              item.is_approved ? styles.unapproveButton : styles.approveButton,
            ]}
            onPress={() => handleToggle(item)}
            disabled={isSubmitting}
          >
            <Text
              style={[
                styles.actionButtonText,
                item.is_approved ? styles.unapproveText : styles.approveText,
              ]}
            >
              {item.is_approved ? 'Unapprove' : 'Approve'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, styles.deleteButton]}
            onPress={() => handleDelete(item.id)}
            disabled={isSubmitting}
          >
            <Text style={[styles.actionButtonText, styles.deleteText]}>Delete</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderPagination = () => {
    if (totalPages <= 1) return null;

    return (
      <View style={styles.paginationRow}>
        <TouchableOpacity
          style={[styles.pageButton, currentPage === 1 && styles.pageButtonDisabled]}
          onPress={() => fetchComments(currentPage - 1)}
          disabled={currentPage === 1}
        >
          <Text style={styles.pageButtonText}>Previous</Text>
        </TouchableOpacity>

        <Text style={styles.pageInfo}>
          Page {currentPage} of {totalPages}
        </Text>

        <TouchableOpacity
          style={[styles.pageButton, currentPage === totalPages && styles.pageButtonDisabled]}
          onPress={() => fetchComments(currentPage + 1)}
          disabled={currentPage === totalPages}
        >
          <Text style={styles.pageButtonText}>Next</Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.headerTitle}>Comment Moderation</Text>
        <Text style={styles.headerSubtitle}>
          {totalCount} comment{totalCount !== 1 ? 's' : ''}
          {totalPages > 1 ? ` · Page ${currentPage} of ${totalPages}` : ''}
        </Text>
      </View>

      {loading && comments.length === 0 ? (
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" />
        </View>
      ) : comments.length === 0 ? (
        <View style={styles.centerContent}>
          <Text style={styles.emptyText}>No comments found.</Text>
        </View>
      ) : (
        <FlatList
          data={[...comments]}
          renderItem={renderComment}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          ListFooterComponent={renderPagination}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerRow: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#111',
  },
  headerSubtitle: {
    fontSize: 13,
    color: '#666',
    marginTop: 2,
  },
  listContent: {
    padding: 16,
    paddingTop: 8,
  },
  commentCard: {
    backgroundColor: 'white',
    borderRadius: 10,
    padding: 16,
    marginBottom: 12,
    boxShadow: '0px 1px 2px rgba(0, 0, 0, 0.08)',
    elevation: 2,
  },
  commentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  authorName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  approvedBadge: {
    backgroundColor: '#dcfce7',
  },
  pendingBadge: {
    backgroundColor: '#fef9c3',
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
  },
  approvedText: {
    color: '#15803d',
  },
  pendingText: {
    color: '#a16207',
  },
  slugRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  slugLabel: {
    fontSize: 12,
    color: '#888',
    marginRight: 4,
  },
  slugValue: {
    fontSize: 12,
    color: '#555',
    fontFamily: 'monospace',
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    overflow: 'hidden',
  },
  contentText: {
    fontSize: 14,
    color: '#444',
    lineHeight: 20,
    marginBottom: 8,
  },
  dateRow: {
    marginBottom: 10,
  },
  dateText: {
    fontSize: 12,
    color: '#999',
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 6,
  },
  actionButtonText: {
    fontSize: 12,
    fontWeight: '600',
  },
  approveButton: {
    backgroundColor: '#dcfce7',
  },
  approveText: {
    color: '#15803d',
  },
  unapproveButton: {
    backgroundColor: '#fef9c3',
  },
  unapproveText: {
    color: '#a16207',
  },
  deleteButton: {
    backgroundColor: '#fee2e2',
  },
  deleteText: {
    color: '#b91c1c',
  },
  paginationRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 16,
  },
  pageButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    backgroundColor: 'white',
  },
  pageButtonDisabled: {
    opacity: 0.4,
  },
  pageButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#333',
  },
  pageInfo: {
    fontSize: 13,
    color: '#666',
  },
  emptyText: {
    fontSize: 15,
    color: '#999',
  },
});
