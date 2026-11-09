export function drawStatusText(context, input,player){
    context.font = '24px Helvetica'
    // Below the "Sprite lab" button and the on-screen pad.
    context.fillText('Last input: '+ input.lastKey, 20, 230);
    context.fillText('Active state: '+ player.currentState.state, 20, 270);

}
