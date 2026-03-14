// Runs inside the tab, touches the page DOM


const inputs = document.querySelectorAll("input, textarea");

inputs.forEach(input => {

  const name = input.name.toLowerCase();

  if(name.includes("email")){
    input.value = "user@email.com";
  }

  if(name.includes("phone")){
    input.value = "1234567890";
  }

});

///gotta move everything to a storage with a collection, key-value typeshit (HIDDEN)
