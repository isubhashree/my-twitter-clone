Tweets = new Meteor.Collection("tweets");
Relationships = new Meteor.Collection("relationShips");

if (Meteor.isClient) {

  Template.body.onRendered(function(){
    console.log(Session.get('iscurrentUser'));
    Session.get('iscurrentUser');
  });

  Template.body.helpers({
    'iscurrentUser':function(){
      return Session.get('iscurrentUser');
    }
  });

  /*===============================================tweetBox Template START====================================================*/
  Template.tweetBox.onRendered(function () {
    Session.set('numChars', 0);
  });

  Template.tweetBox.events({
    'input #tweetText': function(){
      Session.set('numChars', $('#tweetText').val().length);
    },

    'click button':function(){
      var tweet = $('#tweetText').val();
      var currentUser = Session.get('iscurrentUser');
      $('#tweetText').val("");
      Session.set('numChars',0);
      if(currentUser != undefined || currentUser != null){
        Meteor.call('insertTweet', tweet, currentUser);
      }
    }
  });

  Template.tweetBox.helpers({
    charCount: function() {
      return 140 - Session.get('numChars');
    },

    charClass: function() {
      if (Session.get('numChars') > 140) {
        return 'errCharCount';   
      } else {
        return 'charCount';       
      }
    },

    disableButton: function() {
      var currentUser = Session.get('iscurrentUser');
      console.log(currentUser);
      if (Session.get('numChars') <= 0 ||
        Session.get('numChars') > 140 || (currentUser == undefined)){
        return 'disabled';
    }
  },

  'iscurrentUser':function(){
    return Session.get('iscurrentUser');
  }
});

  /*===============================================tweetBox Template END====================================================*/
  /*===============================================userManagement Template START============================================*/
  Template.userManagement.events({
    'submit #newUserForm': function() {
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
          Session.set('iscurrentUser', response);
          console.log(Session.get('iscurrentUser'));
        }
      });
      console.log(Session.get('iscurrentUser'));

      return false;
    },

    'submit #existingUserForm': function() {
      var username = $('#login-username').val();
      var password = $('#login-password').val();

      console.log(username, password);

      Meteor.call('findUser',username, function(error, response){
        if (response){
          console.log(response);
          Session.set('iscurrentUser', response);
          console.log(Session.get('iscurrentUser'));
        }
      });
      return false;
    },

    'click #logout': function() {
      console.log(Session.get('iscurrentUser'));
      Meteor.logout(function(err){
        Session.set('iscurrentUser', undefined);
      });
    }
  });

  Template.userManagement.helpers({  
    'iscurrentUser':function(){
      return Session.get('iscurrentUser');
    },
    'tweets': function() {
      var currentUser = Session.get('iscurrentUser');
      if (currentUser != undefined || currentUser != null) {
        return Tweets.find({ user: currentUser.username }).count();
      }
    },

    'following': function() {
      var currentUser = Session.get('iscurrentUser');
      if (currentUser != undefined|| currentUser != null) {
        return Relationships.find({ follower: currentUser.username }).count();
      }
    },

    'followers': function() {
      var currentUser = Session.get('iscurrentUser');
      if (currentUser != undefined || currentUser != null) {
        return Relationships.find({ following: currentUser.username }).count();
      }
    }
  });
  /*===============================================userManagement Template END==================================================*/
  /*===============================================followUser Template START====================================================*/
  Template.followUsers.onRendered(function(){
    Meteor.call('recommendUsers', Session.get('iscurrentUser'), function(error, response){
      Session.set('recommendedUsers', response);
    });
  });

  Template.followUsers.events({
   'submit form': function(event) {
    var searchUser = event.target.searchUser.value;

    var foundUser = Meteor.call('findUser', searchUser, function(err, res) {
      if (res) Session.set('foundUser', res);
    });
    return false;
  },

  'click #follow': function() {
    Meteor.call('followUser', Session.get('iscurrentUser'), Session.get('foundUser').username);
  },

  'click #followRec': function(event) {
    Meteor.call('followUser',Session.get('iscurrentUser'), this.username);
    $(this).val("");
  }
});

  Template.followUsers.helpers({
    'foundUser':function(){
      return Session.get('foundUser');
    },

    'recommendedUsers': function() {
      return Session.get('recommendedUsers');
    }
  });

  Template.followUsers.onCreated(function() {
   var currentUser = Session.get('iscurrentUser');
   if (currentUser != undefined || currentUser != null){
    this.subscribe('following', currentUser.username);
    this.subscribe('followers', currentUser.username);
    this.subscribe('tweets', currentUser.username);
  }
});

  /*===============================================followUser Template END====================================================*/

  Template.tweetFeed.onCreated(function() {
    var currentUser = Session.get('iscurrentUser');
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
    'showUser':function(){
      return Meteor.users.find({sort: {
        createdAt: -1}, 
        limit: 1
      });
    },

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
    },

    'recommendUsers': function(currentUser) {
      var currentFollowings = Relationships.find({
        follower: currentUser.username
      }).fetch().map(function(data) {
        return data.following;
      });
      currentFollowings.push(currentUser.username);

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

}