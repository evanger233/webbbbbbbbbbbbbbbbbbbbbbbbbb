import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  Modal,
  StyleSheet,
  ScrollView,
  Image,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
  ActivityIndicator,
  Linking
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { StatusBar } from 'expo-status-bar';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';
import * as Contacts from 'expo-contacts';
import * as SMS from 'expo-sms';

const TASKS_STORAGE_KEY = '@todomatic_tasks';

const Todo = () => {
  // States for task management
  const [tasks, setTasks] = useState([]);
  const [filteredTasks, setFilteredTasks] = useState([]);
  const [filter, setFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // States for task creation/editing
  const [modalVisible, setModalVisible] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [currentTask, setCurrentTask] = useState(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState(null);
  const [formattedAddress, setFormattedAddress] = useState(null);
  const [image, setImage] = useState(null);
  const [locationLoading, setLocationLoading] = useState(false);
  
  // Location detail modal
  const [locationDetailVisible, setLocationDetailVisible] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [selectedAddress, setSelectedAddress] = useState(null);

  // Load tasks on component mount
  useEffect(() => {
    loadTasks();
  }, []);

  // Apply filters whenever tasks, filter, or search query changes
  // Using memoized callback to prevent unnecessary re-renders
  const applyFilters = useCallback(() => {
    let result = [...tasks];

    // Apply status filter
    if (filter === 'ACTIVE') {
      result = result.filter(task => !task.completed);
    } else if (filter === 'COMPLETED') {
      result = result.filter(task => task.completed);
    }

    // Apply search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(task =>
        task.title.toLowerCase().includes(query)
      );
    }

    // Sort by creation date (newest first)
    result.sort((a, b) => b.createdAt - a.createdAt);

    setFilteredTasks(result);
  }, [tasks, filter, searchQuery]);

  useEffect(() => {
    applyFilters();
  }, [applyFilters]);

  // Load tasks from AsyncStorage
  const loadTasks = async () => {
    try {
      const storedTasks = await AsyncStorage.getItem(TASKS_STORAGE_KEY);
      if (storedTasks !== null) {
        setTasks(JSON.parse(storedTasks));
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to load tasks');
    }
  };

  // Save tasks to AsyncStorage
  const saveTasks = async (updatedTasks) => {
    try {
      await AsyncStorage.setItem(TASKS_STORAGE_KEY, JSON.stringify(updatedTasks));
    } catch (error) {
      Alert.alert('Error', 'Failed to save tasks');
    }
  };

  // Handle task creation/update
  const handleSaveTask = () => {
    if (!title.trim()) {
      Alert.alert('Error', 'Title is required');
      return;
    }

    const taskData = {
      id: editMode && currentTask ? currentTask.id : Date.now().toString(),
      title,
      description,
      completed: editMode && currentTask ? currentTask.completed : false,
      createdAt: editMode && currentTask ? currentTask.createdAt : Date.now(),
      updatedAt: Date.now(),
      location,
      formattedAddress,
      image
    };

    let updatedTasks;
    if (editMode && currentTask) {
      updatedTasks = tasks.map(task =>
        task.id === currentTask.id ? taskData : task
      );
    } else {
      updatedTasks = [...tasks, taskData];
    }

    setTasks(updatedTasks);
    saveTasks(updatedTasks);
    resetForm();
  };

  // Toggle task completion status
  const toggleTaskStatus = (id) => {
    const updatedTasks = tasks.map(task => {
      if (task.id === id) {
        return { ...task, completed: !task.completed, updatedAt: Date.now() };
      }
      return task;
    });

    setTasks(updatedTasks);
    saveTasks(updatedTasks);
  };

  // Delete task
  const deleteTask = (id) => {
    Alert.alert(
      'Confirm Delete',
      'Are you sure you want to delete this task?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            const updatedTasks = tasks.filter(task => task.id !== id);
            setTasks(updatedTasks);
            saveTasks(updatedTasks);
          }
        }
      ]
    );
  };

  // Edit task
  const editTask = (task) => {
    setCurrentTask(task);
    setTitle(task.title);
    setDescription(task.description || '');
    setLocation(task.location);
    setFormattedAddress(task.formattedAddress);
    setImage(task.image);
    setEditMode(true);
    setModalVisible(true);
  };

  // Reset form
  const resetForm = () => {
    setTitle('');
    setDescription('');
    setLocation(null);
    setFormattedAddress(null);
    setImage(null);
    setCurrentTask(null);
    setEditMode(false);
    setModalVisible(false);
  };

  // Get current location
  const getLocation = async () => {
    setLocationLoading(true);

    try {
      const { status } = await Location.requestForegroundPermissionsAsync();

      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Location permission is required for this feature');
        setLocationLoading(false);
        return;
      }
      console.log('Start obtaining location information....');
      const location = await Location.getCurrentPositionAsync({});
      console.log('location666', location.coords.latitude);
      console.log('Successfully obtained location....');
      setLocation({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      });

      try {
        // Call the reverseGeocodeAsynchronous method and pass in the coordinates
        const addressResponse = await Location.reverseGeocodeAsync({
          latitude: location.coords.latitude,
          longitude: location.coords.longitude
        });

        // Check if there are any results returned
        if (addressResponse && addressResponse.length > 0) {
          const address = addressResponse[0];

          // Combine address information as a readable string
          const addressString = [
            address.name,
            address.street,
            address.district,
            address.city,
            address.region,
            address.country
          ]
            .filter(Boolean) 
            .join(', ');  

          console.log('Obtained address:', addressString);
          setFormattedAddress(addressString);
        } else {
          console.log('Address information not found');
          setFormattedAddress(null);
        }
      } catch (error) {
        console.log('反向地理编码错误:', error);
        setFormattedAddress(null);
      }


    } catch (error) {
      console.log('Reverse geocoding error :', error);
      Alert.alert('Error', 'Failed to get location');
    } finally {
      setLocationLoading(false);
    }
  };

  // Take a photo
  const takePhoto = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();

      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Camera permission is required for this feature');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.7,
      });

      if (!result.canceled) {
        setImage(result.assets[0].uri);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to take photo');
    }
  };

  // Share task via SMS
  const shareViaSMS = async (task) => {
    try {
      const isAvailable = await SMS.isAvailableAsync();

      if (!isAvailable) {
        Alert.alert('Not Available', 'SMS is not available on this device');
        return;
      }

      const { result } = await SMS.sendSMSAsync(
        [],
        `Task: ${task.title}\n${task.description ? `Description: ${task.description}\n` : ''}Status: ${task.completed ? 'Completed' : 'Active'}`
      );

      if (result === 'cancelled') {
        Alert.alert('Cancelled', 'SMS sending was cancelled');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to send SMS');
    }
  };

  // Pick a contact
  const pickContact = async () => {
    try {
      const { status } = await Contacts.requestPermissionsAsync();

      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Contacts permission is required for this feature');
        return;
      }

      const { data } = await Contacts.getContactsAsync({
        fields: [Contacts.Fields.PhoneNumbers],
      });

      if (data.length > 0) {
        // Show contact picker (simplified for this implementation)
        Alert.alert(
          'Contact Selected',
          `Selected ${data[0].name}`,
          [{ text: 'OK' }]
        );
      } else {
        Alert.alert('No Contacts', 'No contacts found on device');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to access contacts');
    }
  };

  // Show location detail
  const showLocationDetail = (location, address) => {
    setSelectedLocation(location);
    setSelectedAddress(address);
    setLocationDetailVisible(true);
  };

  // Render task item
  const renderTaskItem = ({ item }) => (
    <View style={styles.taskItem}>
      <TouchableOpacity
        style={styles.taskStatusButton}
        onPress={() => toggleTaskStatus(item.id)}
      >
        <View style={[
          styles.checkCircle,
          item.completed && styles.checkCircleCompleted
        ]}>
          {item.completed && <Ionicons name="checkmark" size={18} color="#fff" />}
        </View>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.taskContent}
        onPress={() => editTask(item)}
        activeOpacity={0.7}
      >
        <View style={styles.taskTextContainer}>
          <Text
            style={[
              styles.taskTitle,
              item.completed && styles.taskTitleCompleted
            ]}
            numberOfLines={1}
          >
            {item.title}
          </Text>
          {item.description ? (
            <Text
              style={[
                styles.taskDescription,
                item.completed && styles.taskDescriptionCompleted
              ]}
              numberOfLines={2}
            >
              {item.description}
            </Text>
          ) : null}

          <View style={styles.taskMeta}>
            <Text style={styles.taskDate}>
              {new Date(item.createdAt).toLocaleDateString()}
            </Text>

            {item.location && (
              <TouchableOpacity 
                style={styles.locationTag}
                onPress={() => showLocationDetail(item.location, item.formattedAddress)}
              >
                <Ionicons name="location" size={12} color="#667085" />
                {item.formattedAddress ? (
                  <Text 
                    style={styles.locationText} 
                    numberOfLines={1}
                    ellipsizeMode="tail"
                  >
                    {item.formattedAddress}
                  </Text>
                ) : (
                  <Text style={styles.locationText}>
                    {item.location.latitude.toFixed(4)}, {item.location.longitude.toFixed(4)}
                  </Text>
                )}
              </TouchableOpacity>
            )}
          </View>
        </View>

        {item.image && (
          <Image
            source={{ uri: item.image }}
            style={styles.taskImage}
            resizeMode="cover"
          />
        )}
      </TouchableOpacity>

      <View style={styles.taskActions}>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => shareViaSMS(item)}
        >
          <Ionicons name="chatbubble-outline" size={20} color="#667085" />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => deleteTask(item.id)}
        >
          <Ionicons name="trash-outline" size={20} color="#667085" />
        </TouchableOpacity>
      </View>
    </View>
  );

  // Memoize empty state to prevent re-renders
  const EmptyState = React.memo(() => (
    <View style={styles.emptyContainer}>
      <MaterialIcons name="assignment" size={80} color="#E0E0E0" />
      <Text style={styles.emptyText}>
        {searchQuery
          ? 'No tasks match your search'
          : filter !== 'ALL'
            ? `No ${filter.toLowerCase()} tasks`
            : 'Add your first task'}
      </Text>
      <Text style={styles.emptySubText}>
        {searchQuery
          ? 'Try using different keywords'
          : filter !== 'ALL'
            ? 'Change the filter or add new tasks'
            : 'Tap the + button to create a new task'}
      </Text>
    </View>
  ));

    return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <StatusBar style="dark" />

      <View style={styles.header}>
        <Text style={styles.title}>TodoMatic</Text>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => setModalVisible(true)}
        >
          <Ionicons name="add" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      <View style={styles.searchContainer}>
        <View style={styles.searchInputContainer}>
          <Ionicons name="search" size={20} color="#667085" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search tasks by title..."
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={20} color="#667085" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <View style={styles.filterContainer}>
        <TouchableOpacity
          style={[
            styles.filterButton,
            filter === 'ALL' && styles.filterButtonActive
          ]}
          onPress={() => setFilter('ALL')}
        >
          <Text
            style={[
              styles.filterButtonText,
              filter === 'ALL' && styles.filterButtonTextActive
            ]}
          >
            All
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.filterButton,
            filter === 'ACTIVE' && styles.filterButtonActive
          ]}
          onPress={() => setFilter('ACTIVE')}
        >
          <Text
            style={[
              styles.filterButtonText,
              filter === 'ACTIVE' && styles.filterButtonTextActive
            ]}
          >
            Active
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.filterButton,
            filter === 'COMPLETED' && styles.filterButtonActive
          ]}
          onPress={() => setFilter('COMPLETED')}
        >
          <Text
            style={[
              styles.filterButtonText,
              filter === 'COMPLETED' && styles.filterButtonTextActive
            ]}
          >
            Completed
          </Text>
        </TouchableOpacity>
      </View>

      {filteredTasks.length > 0 ? (
        <FlatList
          data={filteredTasks}
          renderItem={renderTaskItem}
          keyExtractor={item => item.id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.taskList}
        />
      ) : (
        <EmptyState />
      )}

      {/* Task creation/edit modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={resetForm}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={resetForm}
        >
          <TouchableOpacity
            activeOpacity={1}
            style={styles.modalContent}
            onPress={() => Keyboard.dismiss()}
          >
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {editMode ? 'Edit Task' : 'Add New Task'}
              </Text>
              <TouchableOpacity
                onPress={resetForm}
                style={styles.closeButton}
              >
                <Ionicons name="close" size={24} color="#667085" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.inputLabel}>Title</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter task title"
                value={title}
                onChangeText={setTitle}
              />

              <Text style={styles.inputLabel}>Description (Optional)</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Enter task description"
                value={description}
                onChangeText={setDescription}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />

              <View style={styles.featuresContainer}>
                <TouchableOpacity
                  style={styles.featureButton}
                  onPress={getLocation}
                >
                  <View style={styles.featureIconContainer}>
                    <Ionicons name="location" size={22} color="#7F56D9" />
                  </View>
                  <Text style={styles.featureText}>
                    {location ? 'Update Location' : 'Add Location'}
                  </Text>
                  {locationLoading && (
                    <ActivityIndicator size="small" color="#7F56D9" />
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.featureButton}
                  onPress={takePhoto}
                >
                  <View style={styles.featureIconContainer}>
                    <Ionicons name="camera" size={22} color="#7F56D9" />
                  </View>
                  <Text style={styles.featureText}>Take Photo</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.featureButton}
                  onPress={pickContact}
                >
                  <View style={styles.featureIconContainer}>
                    <Ionicons name="people" size={22} color="#7F56D9" />
                  </View>
                  <Text style={styles.featureText}>Assign Contact</Text>
                </TouchableOpacity>
              </View>

              {image && (
                <View style={styles.imagePreviewContainer}>
                  <Image
                    source={{ uri: image }}
                    style={styles.imagePreview}
                    resizeMode="cover"
                  />
                  <TouchableOpacity
                    style={styles.removeImageButton}
                    onPress={() => setImage(null)}
                  >
                    <Ionicons name="close-circle" size={24} color="#fff" />
                  </TouchableOpacity>
                </View>
              )}

              {location && (
                <View style={styles.locationContainer}>
                  <View 
                    style={styles.locationInfo}
                  >
                    <Ionicons name="location" size={18} color="#7F56D9" />
                    {formattedAddress ? (
                      <Text 
                        style={[styles.locationText, styles.locationAddressText]} 
                        numberOfLines={2}
                        ellipsizeMode="tail"
                      >
                        {formattedAddress}
                      </Text>
                    ) : (
                      <Text style={styles.locationText}>
                        {location.latitude.toFixed(6)}, {location.longitude.toFixed(6)}
                      </Text>
                    )}
                  </View>
                  <TouchableOpacity
                    style={styles.removeButton}
                    onPress={() => {
                      setLocation(null);
                      setFormattedAddress(null);
                    }}
                  >
                    <Text style={styles.removeButtonText}>Remove</Text>
                  </TouchableOpacity>
                </View>
              )}

              <TouchableOpacity
                style={styles.saveButton}
                onPress={handleSaveTask}
              >
                <Text style={styles.saveButtonText}>
                  {editMode ? 'Update Task' : 'Save Task'}
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Location detail modal */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={locationDetailVisible}
        onRequestClose={() => setLocationDetailVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setLocationDetailVisible(false)}
        >
          <View style={styles.locationDetailContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                Location Detail
              </Text>
              <TouchableOpacity
                onPress={() => setLocationDetailVisible(false)}
                style={styles.closeButton}
              >
                <Ionicons name="close" size={24} color="#667085" />
              </TouchableOpacity>
            </View>

            <View style={styles.locationDetailBody}>
              {selectedAddress ? (
                <View style={styles.addressContainer}>
                  <Ionicons name="navigate" size={24} color="#7F56D9" />
                  <Text style={styles.fullAddressText}>{selectedAddress}</Text>
                </View>
              ) : null}
              
              {selectedLocation ? (
                <View style={styles.coordinatesContainer}>
                  <Text style={styles.coordinatesLabel}>Longitude: </Text>
                  <Text style={styles.coordinatesValue}>{selectedLocation.longitude.toFixed(6)}</Text>
                </View>
              ) : null}
              
              {selectedLocation ? (
                <View style={styles.coordinatesContainer}>
                  <Text style={styles.coordinatesLabel}>Latitude: </Text>
                  <Text style={styles.coordinatesValue}>{selectedLocation.latitude.toFixed(6)}</Text>
                </View>
              ) : null}
              
              <TouchableOpacity
                style={styles.locationActionButton}
                onPress={() => {
                  if (selectedLocation) {
                    try {
                      let url;
                      if (Platform.OS === 'ios') {
                        url = `maps:0,0?q=${selectedLocation.latitude},${selectedLocation.longitude}`;
                      } else {
                        url = `geo:${selectedLocation.latitude},${selectedLocation.longitude}?q=${selectedLocation.latitude},${selectedLocation.longitude}`;
                      }
                    
                      Linking.canOpenURL(url)
                        .then(supported => {
                          if (supported) {
                            Linking.openURL(url);
                            setLocationDetailVisible(false);
                          } else {
                            const webUrl = `https://www.google.com/maps/search/?api=1&query=${selectedLocation.latitude},${selectedLocation.longitude}`;
                            Linking.openURL(webUrl).catch(err => {
                              Alert.alert('Error', 'Unable to open map application');
                            });
                          }
                        })
                        .catch(err => {
                          console.error('Link opening error:', err);
                          Alert.alert('Error', 'Unable to open map application');
                        });
                    } catch (error) {
                      console.error('Link opening error:', error);
                      Alert.alert('Error', 'Unable to open map application');
                    }
                  }
                }}
              >
                <Ionicons name="map" size={20} color="#FFFFFF" />
                <Text style={styles.locationActionButtonText}>View in the map</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E4E7EC',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#101828',
  },
  addButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#7F56D9',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#7F56D9',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  searchContainer: {
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E4E7EC',
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F2F4F7',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 16,
    color: '#101828',
  },
  filterContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E4E7EC',
  },
  filterButton: {
    paddingVertical: 6,
    paddingHorizontal: 16,
    borderRadius: 20,
    marginRight: 10,
    backgroundColor: '#F2F4F7',
  },
  filterButtonActive: {
    backgroundColor: '#F4EBFF',
  },
  filterButtonText: {
    fontSize: 14,
    color: '#667085',
    fontWeight: '500',
  },
  filterButtonTextActive: {
    color: '#7F56D9',
    fontWeight: '600',
  },
  taskList: {
    paddingHorizontal: 20,
    paddingTop: 15,
    paddingBottom: 20,
  },
  taskItem: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  taskStatusButton: {
    marginRight: 12,
    paddingTop: 2,
  },
  checkCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#7F56D9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkCircleCompleted: {
    backgroundColor: '#7F56D9',
  },
  taskContent: {
    flex: 1,
    flexDirection: 'row',
  },
  taskTextContainer: {
    flex: 1,
    marginRight: 10,
  },
  taskTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#101828',
    marginBottom: 4,
  },
  taskTitleCompleted: {
    color: '#98A2B3',
    textDecorationLine: 'line-through',
  },
  taskDescription: {
    fontSize: 14,
    color: '#667085',
    marginBottom: 8,
  },
  taskDescriptionCompleted: {
    color: '#98A2B3',
  },
  taskMeta: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  taskDate: {
    fontSize: 12,
    color: '#667085',
    marginRight: 10,
  },
  locationTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F2F4F7',
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
    maxWidth: '70%',
  },
  locationText: {
    fontSize: 12,
    color: '#667085',
    marginLeft: 2,
  },
  locationAddressText: {
    fontSize: 14,
    flex: 1,
  },
  taskImage: {
    width: 60,
    height: 60,
    borderRadius: 8,
  },
  taskActions: {
    marginLeft: 12,
    justifyContent: 'center',
  },
  actionButton: {
    padding: 6,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#101828',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubText: {
    fontSize: 14,
    color: '#667085',
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingBottom: 30,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E4E7EC',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#101828',
    paddingLeft: 10
  },
  closeButton: {
    padding: 4,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#344054',
    marginTop: 16,
    marginBottom: 6,
  },
  input: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E4E7EC',
    borderRadius: 10,
    padding: 12,
    fontSize: 16,
    color: '#101828',
  },
  textArea: {
    minHeight: 100,
  },
  featuresContainer: {
    marginTop: 24,
    borderWidth: 1,
    borderColor: '#E4E7EC',
    borderRadius: 12,
    overflow: 'hidden',
  },
  featureButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E4E7EC',
  },
  featureIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F4EBFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  featureText: {
    flex: 1,
    fontSize: 16,
    color: '#344054',
  },
  imagePreviewContainer: {
    marginTop: 20,
    position: 'relative',
  },
  imagePreview: {
    width: '100%',
    height: 200,
    borderRadius: 12,
  },
  removeImageButton: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 15,
  },
  locationContainer: {
    marginTop: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F9F5FF',
    borderRadius: 10,
    padding: 12,
  },
  locationInfo: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    flex: 1,
    marginRight: 10,
  },
  removeButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  removeButtonText: {
    fontSize: 14,
    color: '#7F56D9',
    fontWeight: '500',
  },
  saveButton: {
    backgroundColor: '#7F56D9',
    borderRadius: 10,
    padding: 16,
    alignItems: 'center',
    marginTop: 30,
    marginBottom: 10,
    shadowColor: '#7F56D9',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  locationDetailContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    width: '90%',
    maxWidth: 400,
    alignSelf: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
    marginTop: 'auto',
    marginBottom: 'auto',
  },
  locationDetailBody: {
    padding: 20,
  },
  addressContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 20,
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#E4E7EC',
  },
  fullAddressText: {
    fontSize: 16,
    color: '#101828',
    marginLeft: 10,
    flex: 1,
    lineHeight: 24,
  },
  coordinatesContainer: {
    flexDirection: 'row',
    marginBottom: 10,
  },
  coordinatesLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#667085',
    width: 100,
  },
  coordinatesValue: {
    fontSize: 14,
    color: '#101828',
  },
  locationActionButton: {
    backgroundColor: '#7F56D9',
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
    marginTop: 20,
    flexDirection: 'row',
    justifyContent: 'center',
  },
  locationActionButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginLeft: 8,
  },
});

export default Todo;