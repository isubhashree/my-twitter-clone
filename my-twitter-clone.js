Tweets = new Meteor.Collection("tweets");
Relationships = new Meteor.Collection("relationShips");

if (Meteor.isClient) {

	var AmplifiedSession = _.extend({}, Session, {
    keys: _.object(_.map(amplify.store(), function (value, key) {
      return [key, JSON.stringify(value)];
    })),
    set: function (key, value) {
      Session.set.apply(this, arguments);
      amplify.store(key, value);
    }
  });

  Template.body.helpers({
    'iscurrentUser':function(){
    	console.log(AmplifiedSession.get('iscurrentUser'));
      return AmplifiedSession.get('iscurrentUser');
    }
  });

  /*===============================================tweetBox Template START====================================================*/
  Template.tweetBox.onRendered(function () {
    AmplifiedSession.set('numChars', 0);
  });

  Template.tweetBox.events({
    'input #tweetText': function(){
      AmplifiedSession.set('numChars', $('#tweetText').val().length);
    },

    'click button':function(){
      var tweet = $('#tweetText').val();
      var currentUser = AmplifiedSession.get('iscurrentUser');
      $('#tweetText').val("");
      AmplifiedSession.set('numChars',0);
      if(currentUser != undefined || currentUser != null){
        Meteor.call('insertTweet', tweet, currentUser);
      }
    }
  });

  Template.tweetBox.helpers({
    charCount: function() {
      return 140 - AmplifiedSession.get('numChars');
    },

    charClass: function() {
      if (AmplifiedSession.get('numChars') > 140) {
        return 'errCharCount';   
      } else {
        return 'charCount';       
      }
    },

    disableButton: function() {
      var currentUser = AmplifiedSession.get('iscurrentUser');
      console.log(currentUser);
      if (AmplifiedSession.get('numChars') <= 0 ||
        AmplifiedSession.get('numChars') > 140 || (currentUser == undefined)){
        return 'disabled';
    }
  },

  'iscurrentUser':function(){
    return AmplifiedSession.get('iscurrentUser');
  }
});

  /*===============================================tweetBox Template END====================================================*/
  /*===============================================userManagement Template START============================================*/
  Template.userManagement.events({
    'click #signup': function() {
      var user = {
        username: $('#signup-username').val(),
        password: $('#signup-password').val(),
        profile: {
          fullname: $('#signup-fullname').val()
        }
      };

      Accounts.createUser(user, function (error) {
        if (error) console.log(error);
      });

      Meteor.call('findUser',user.username, function(error, response){
        if (response){
          console.log(response);
          AmplifiedSession.set('iscurrentUser', response);
          console.log(AmplifiedSession.get('iscurrentUser'));
        }
      });
      return false;
    },

    'click #login': function() {
      var username = $('#login-username').val();
      var password = $('#login-password').val();

      Meteor.call('findUser',username, function(error, response){
        if (response){
          console.log(response);
          AmplifiedSession.set('iscurrentUser', response);
          console.log(AmplifiedSession.get('iscurrentUser'));
        }
      });
      return false;
    },

    'click #logout': function() {
      console.log(AmplifiedSession.get('iscurrentUser'));
      Meteor.logout(function(err){
        AmplifiedSession.set('iscurrentUser', null);
      });
    }
  });

  Template.userManagement.helpers({  
    'iscurrentUser':function(){
      return AmplifiedSession.get('iscurrentUser');
    },
    'tweets': function() {
      var currentUser = AmplifiedSession.get('iscurrentUser');
      if (currentUser != undefined || currentUser != null) {
        return Tweets.find({ user: currentUser.username }).count();
      }
    },

    'following': function() {
      var currentUser = AmplifiedSession.get('iscurrentUser');
      if (currentUser != undefined|| currentUser != null) {
        return Relationships.find({ follower: currentUser.username }).count();
      }
    },

    'followers': function() {
      var currentUser = AmplifiedSession.get('iscurrentUser');
      if (currentUser != undefined || currentUser != null) {
        return Relationships.find({ following: currentUser.username }).count();
      }
    }
  });
  /*===============================================userManagement Template END==================================================*/
  /*===============================================followUser Template START====================================================*/
  Template.followUsers.onRendered(function(){
  	AmplifiedSession.set('foundUser',null);
  });

  Template.followUsers.events({
   'submit form': function(event) {
    var searchUser = event.target.searchUser.value;

    var foundUser = Meteor.call('findUser', searchUser, function(err, res) {
      if (res) AmplifiedSession.set('foundUser', res);
    });
    return false;
  },

  'click #follow': function() {
    Meteor.call('followUser', AmplifiedSession.get('iscurrentUser'), AmplifiedSession.get('foundUser').username);
    AmplifiedSession.set('foundUser', null);
  },

  'click #followRec': function(event) {
    Meteor.call('followUser',AmplifiedSession.get('iscurrentUser'), this.username);
  }
});

  Template.followUsers.helpers({
    'foundUser':function(){
      return AmplifiedSession.get('foundUser');
    },

    'recommendedUsers': function() {
    	var username = AmplifiedSession.get('iscurrentUser').username;
    	var currentFollowings = Relationships.find({
        follower: username
      }).fetch().map(function(data) {
        return data.following;
      });
      currentFollowings.push(username);

      var recUsers = Meteor.users.find({
        username: {
          $nin: currentFollowings
        }
      }, {
        fields: { 'username': 1 },
        limit: 5
      }).fetch();

      return recUsers;
  }
      //return AmplifiedSession.get('recommendedUsers');
    
  });

  Template.followUsers.onCreated(function() {
   var currentUser = AmplifiedSession.get('iscurrentUser');
   if (currentUser != undefined || currentUser != null){
    this.subscribe('following', currentUser.username);
    this.subscribe('followers', currentUser.username);
    this.subscribe('tweets', currentUser.username);
    this.subscribe('recommendedUsers', currentUser.username);
  }
});

  /*===============================================followUser Template END====================================================*/

  Template.tweetFeed.onCreated(function() {
    var currentUser = AmplifiedSession.get('iscurrentUser');
    if (currentUser != undefined || currentUser != null) {
      this.subscribe('tweets', currentUser.username);
      this.subscribe('ownTweets', currentUser.username);
    }  
  });

  Template.tweetFeed.helpers({  
    'tweetMessage': function() {
      return Tweets.find({}, { 
        sort: {timestamp: -1}, 
        limit: 10
      });
    }
  });
}

if (Meteor.isServer) {
  Meteor.startup(function () {
    Relationships._ensureIndex({follower: 1, following: 1}, {unique: 1});
  });

  Meteor.methods({
    'findUser': function(username) {
      return Meteor.users.findOne({
        username: username
      }, {
        fields: { 'username': 1 }
      });
    },

    'followUser': function(currentUser, username) {
      Relationships.insert({
        follower: currentUser.username,
        following: username
      });
    },

    'insertTweet': function(tweet, currentUser){ 
      Tweets.insert({
        message: tweet,
        user: currentUser.username,
        timestamp: new Date()
      });    
    }
  });

  Meteor.publishComposite('tweets', function(username) {  
    return {
      find: function() {
        return Relationships.find({ follower: username });
      },
      children: [{
        find: function(relationship) {
          return Tweets.find({user: relationship.following});
        }
      }]
    }
  });

  Meteor.publish('ownTweets', function(username) {  
    return Tweets.find({user: username});
  });

  Meteor.publish('followings', function(username) {  
    return Relationships.find({ follower: username });
  });

  Meteor.publish('followers', function(username) {  
    return Relationships.find({ following: username });
  });

  Meteor.publish('recommendedUsers',function(username){
  	 var currentFollowings = Relationships.find({
        follower: username
      }).fetch().map(function(data) {
        return data.following;
      });
      currentFollowings.push(username);

      var recUsers = Meteor.users.find({
        username: {
          $nin: currentFollowings
        }});

      return recUsers;
  });
}